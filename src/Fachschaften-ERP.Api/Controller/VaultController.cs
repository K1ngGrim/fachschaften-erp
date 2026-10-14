using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Tresore für vertrauliche Tabellen. Der Server speichert nur öffentliche Schlüssel und
/// verschlüsselte private Schlüssel; entschlüsselt wird ausschließlich im Browser.
/// </summary>
[ApiController]
[Route("/api/vault")]
public class VaultController(CoreContext db) : ControllerBase
{
    private const int MinIterations = 100_000;
    private const int MaxIterations = 10_000_000;

    /// <summary>Eigener Tresor; 404, wenn noch keiner eingerichtet ist.</summary>
    [HttpGet]
    public async Task<ActionResult<VaultDto>> Get()
    {
        var userId = ((Invoker)User).UserId;
        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.UserId == userId);
        return vault is null ? NotFound() : Ok(ToDto(vault));
    }

    /// <summary>
    /// Legt den eigenen Tresor an oder ändert ihn. Gleicher öffentlicher Schlüssel: nur die
    /// Passphrase wurde geändert. Neuer Schlüssel: der Tresor wurde zurückgesetzt, bisherige
    /// Freigaben sind damit wertlos und werden entfernt.
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<VaultDto>> Save(SaveVaultRequest request)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var userId = ((Invoker)User).UserId;
        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.UserId == userId);
        await SaveAsync(vault, request, userId, isRecovery: false);
        return Ok(ToDto((await db.Vaults.FirstAsync(v => v.UserId == userId))));
    }

    /// <summary>
    /// Öffentlicher Teil des Wiederherstellungs-Tresors (nicht geheim); 404, wenn keiner eingerichtet ist.
    /// </summary>
    [HttpGet("recovery")]
    public async Task<ActionResult<RecoveryVaultInfoDto>> GetRecovery()
    {
        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.IsRecovery);
        return vault is null ? NotFound() : Ok(new RecoveryVaultInfoDto(vault.Id, vault.PublicKey, vault.Created));
    }

    /// <summary>Wiederherstellungs-Tresor mit verschlüsseltem privatem Schlüssel und allen Tabellenschlüsseln.</summary>
    [RequirePermission(PermissionType.SettingsWrite)]
    [HttpGet("recovery/keys")]
    public async Task<ActionResult<RecoveryVaultDto>> GetRecoveryKeys()
    {
        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.IsRecovery);
        if (vault is null) return NotFound();

        var keys = await db.CustomTableKeys
            .Where(k => k.VaultId == vault.Id && k.Table!.IsActive && k.Table.IsConfidential)
            .Select(k => new RecoveryTableKeyDto(k.TableId, k.Table!.Name, k.Table.KeyVersion, k.WrappedKey))
            .ToListAsync();
        return Ok(new RecoveryVaultDto(ToDto(vault), keys));
    }

    /// <summary>
    /// Richtet den Wiederherstellungs-Tresor ein oder ersetzt ihn. Beim Ersetzen werden die alten
    /// Tabellenschlüssel entfernt; Mitglieder mit Zugriff ergänzen sie beim nächsten Öffnen der Tabelle.
    /// </summary>
    [RequirePermission(PermissionType.SettingsWrite)]
    [HttpPut("recovery")]
    public async Task<ActionResult<RecoveryVaultInfoDto>> SaveRecovery(SaveVaultRequest request)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.IsRecovery);
        await SaveAsync(vault, request, null, isRecovery: true);
        vault = await db.Vaults.FirstAsync(v => v.IsRecovery);
        return Ok(new RecoveryVaultInfoDto(vault.Id, vault.PublicKey, vault.Created));
    }

    private async Task SaveAsync(VaultEntity? vault, SaveVaultRequest request, Guid? userId, bool isRecovery)
    {
        var now = DateTimeOffset.UtcNow;
        if (vault is null)
        {
            vault = new VaultEntity { Id = Guid.NewGuid(), UserId = userId, IsRecovery = isRecovery, Created = now };
            db.Vaults.Add(vault);
        }
        else if (vault.PublicKey != request.PublicKey)
        {
            // Neuer Schlüssel: alte Freigaben lassen sich nicht mehr entschlüsseln.
            db.CustomTableKeys.RemoveRange(await db.CustomTableKeys.Where(k => k.VaultId == vault.Id).ToListAsync());
            vault.Created = now;
            vault.Modified = null;
        }
        else
        {
            vault.Modified = now;
        }

        vault.PublicKey = request.PublicKey;
        vault.EncryptedPrivateKey = request.EncryptedPrivateKey;
        vault.Salt = request.Salt;
        vault.Iterations = request.Iterations;
        await db.SaveChangesAsync();
    }

    private static string? Validate(SaveVaultRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PublicKey) || request.PublicKey.Length > 1000) return "Invalid public key.";
        if (string.IsNullOrWhiteSpace(request.EncryptedPrivateKey) || request.EncryptedPrivateKey.Length > 4000)
            return "Invalid private key.";
        if (string.IsNullOrWhiteSpace(request.Salt) || request.Salt.Length > 100) return "Invalid salt.";
        if (request.Iterations is < MinIterations or > MaxIterations) return "Invalid iteration count.";
        if (!IsBase64(request.PublicKey) || !IsBase64(request.EncryptedPrivateKey) || !IsBase64(request.Salt))
            return "Keys must be Base64.";
        return null;
    }

    private static bool IsBase64(string value) => Convert.TryFromBase64String(value, new byte[value.Length], out _);

    private static VaultDto ToDto(VaultEntity vault) =>
        new(vault.Id, vault.PublicKey, vault.EncryptedPrivateKey, vault.Salt, vault.Iterations,
            vault.Modified ?? vault.Created);
}

public record VaultDto(
    Guid Id,
    string PublicKey,
    string EncryptedPrivateKey,
    string Salt,
    int Iterations,
    DateTimeOffset UpdatedAt);

public record SaveVaultRequest(string PublicKey, string EncryptedPrivateKey, string Salt, int Iterations);

public record RecoveryVaultInfoDto(Guid Id, string PublicKey, DateTimeOffset CreatedAt);

public record RecoveryTableKeyDto(Guid TableId, string TableName, int KeyVersion, string WrappedKey);

public record RecoveryVaultDto(VaultDto Vault, IList<RecoveryTableKeyDto> Keys);
