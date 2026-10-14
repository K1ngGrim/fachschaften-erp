using System.Text.Json;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Vertrauliche Tabellen: verschlüsseln, Zugriff freigeben und entziehen. Alle Schlüssel kommen
/// fertig verschlüsselt aus dem Browser; der Server prüft nur, wer was speichern darf.
/// </summary>
[ApiController]
[Route("/api/custom-tables/{id:guid}")]
public class CustomTableAccessController(CoreContext db) : ControllerBase
{
    private const int MaxEncryptedLength = 200_000;

    /// <summary>Alle Benutzer mit Tresor-Status und Freigabe für diese Tabelle.</summary>
    [RequirePermission(PermissionType.TablesRead)]
    [HttpGet("access")]
    public async Task<ActionResult<TableAccessDto>> GetAccess(Guid id)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();

        var vaults = await db.Vaults.ToListAsync();
        var granted = await db.CustomTableKeys.Where(k => k.TableId == id).Select(k => k.VaultId).ToListAsync();
        var users = await db.Users
            .OrderBy(u => u.DisplayName ?? u.UserName)
            .Select(u => new { u.Id, Name = u.DisplayName ?? u.UserName ?? string.Empty, u.Email })
            .ToListAsync();

        var members = users.Select(u =>
        {
            var vault = vaults.FirstOrDefault(v => v.UserId == u.Id);
            return new TableAccessMemberDto(u.Id, u.Name, u.Email, vault?.Id, vault?.PublicKey,
                vault is not null && granted.Contains(vault.Id));
        }).ToList();

        var recovery = vaults.FirstOrDefault(v => v.IsRecovery);
        return Ok(new TableAccessDto(members, recovery?.Id, recovery?.PublicKey,
            recovery is not null && granted.Contains(recovery.Id)));
    }

    /// <summary>
    /// Gibt einem Benutzer Zugriff. Erlaubt mit eigener Freigabe; ohne nur für sich selbst mit
    /// Einstellungsrecht (Wiederherstellung über den Wiederherstellungsschlüssel).
    /// </summary>
    [RequirePermission(PermissionType.TableDesignWrite)]
    [HttpPost("access")]
    public async Task<IActionResult> Grant(Guid id, GrantTableAccessRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive && t.IsConfidential);
        if (table is null) return NotFound();
        if (request.KeyVersion != table.KeyVersion) return KeyVersionConflict();
        if (!IsValidCiphertext(request.WrappedKey, 1000)) return BadRequest("Invalid wrapped key.");

        var userId = ((Invoker)User).UserId;
        var isSelf = request.UserId == userId;
        var mayRecover = isSelf && User.HasClaim("permission", PermissionType.SettingsWrite.GetDescription());
        if (!await HasAccessAsync(id) && !mayRecover) return Forbid();

        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.UserId == request.UserId);
        if (vault is null) return BadRequest("The user has not set up a vault yet.");

        await SetKeyAsync(id, vault.Id, request.WrappedKey, userId);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Ergänzt den Schlüssel für den Wiederherstellungs-Tresor, falls er fehlt.</summary>
    [RequirePermission(PermissionType.TablesRead)]
    [HttpPost("recovery-key")]
    public async Task<IActionResult> AddRecoveryKey(Guid id, AddRecoveryKeyRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive && t.IsConfidential);
        if (table is null) return NotFound();
        if (request.KeyVersion != table.KeyVersion) return KeyVersionConflict();
        if (!await HasAccessAsync(id)) return Forbid();
        if (!IsValidCiphertext(request.WrappedKey, 1000)) return BadRequest("Invalid wrapped key.");

        var recovery = await db.Vaults.FirstOrDefaultAsync(v => v.IsRecovery);
        if (recovery is null) return BadRequest("No recovery vault is set up.");

        await SetKeyAsync(id, recovery.Id, request.WrappedKey, ((Invoker)User).UserId);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Macht eine Tabelle vertraulich: alle Einträge kommen verschlüsselt, Klartext wird gelöscht
    /// (auch der gelöschter Einträge).
    /// </summary>
    [RequirePermission(PermissionType.TableDesignWrite)]
    [RequirePermission(PermissionType.TablesWrite)]
    [HttpPost("confidential")]
    public async Task<IActionResult> MakeConfidential(Guid id, EncryptTableRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();
        if (table.IsConfidential) return Conflict("The table is already confidential.");

        var error = await ApplyKeyAsync(table, request.Keys, request.Rows);
        if (error is not null) return BadRequest(error);

        table.IsConfidential = true;
        table.KeyVersion = 1;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Wechselt den Tabellenschlüssel, z. B. um Zugriff zu entziehen: wer nicht in
    /// <see cref="RotateTableKeyRequest.Keys"/> steht, verliert den Zugriff.
    /// </summary>
    [RequirePermission(PermissionType.TableDesignWrite)]
    [HttpPost("rotate-key")]
    public async Task<IActionResult> RotateKey(Guid id, RotateTableKeyRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive && t.IsConfidential);
        if (table is null) return NotFound();
        if (!await HasAccessAsync(id)) return Forbid();
        if (request.BaseKeyVersion != table.KeyVersion) return KeyVersionConflict();

        var error = await ApplyKeyAsync(table, request.Keys, request.Rows);
        if (error is not null) return BadRequest(error);

        table.KeyVersion++;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Ersetzt Schlüssel und Einträge einer Tabelle. Der eigene Tresor und (falls vorhanden) der
    /// Wiederherstellungs-Tresor müssen dabei sein, und jeder aktive Eintrag genau einmal.
    /// </summary>
    private async Task<string?> ApplyKeyAsync(
        CustomTableEntity table,
        IList<VaultKeyDto>? keys,
        IList<EncryptedRowDto>? rows)
    {
        keys ??= [];
        rows ??= [];
        var userId = ((Invoker)User).UserId;

        if (keys.Select(k => k.VaultId).Distinct().Count() != keys.Count) return "Duplicate vault.";
        if (keys.Any(k => !IsValidCiphertext(k.WrappedKey, 1000))) return "Invalid wrapped key.";

        var vaultIds = keys.Select(k => k.VaultId).ToList();
        var vaults = await db.Vaults.Where(v => vaultIds.Contains(v.Id)).ToListAsync();
        if (vaults.Count != keys.Count) return "Unknown vault.";
        if (!vaults.Any(v => v.UserId == userId)) return "Your own vault must be included.";
        if (await db.Vaults.AnyAsync(v => v.IsRecovery) && !vaults.Any(v => v.IsRecovery))
            return "The recovery vault must be included.";

        var allRows = await db.CustomTableRows.Where(r => r.TableId == table.Id).ToListAsync();
        var active = allRows.Where(r => r.IsActive).ToDictionary(r => r.Id);
        if (rows.Count != active.Count || rows.Select(r => r.Id).Distinct().Count() != rows.Count ||
            rows.Any(r => !active.ContainsKey(r.Id)))
            return "Every entry of the table must be included exactly once.";
        if (rows.Any(r => !IsValidCiphertext(r.EncryptedValues, MaxEncryptedLength))) return "Invalid encrypted values.";

        var now = DateTimeOffset.UtcNow;
        foreach (var row in rows)
        {
            var entity = active[row.Id];
            entity.EncryptedValues = row.EncryptedValues;
            entity.Values = JsonDocument.Parse("{}");
        }

        // Gelöschte Einträge: weder Klartext noch Chiffretext mit altem Schlüssel aufheben.
        foreach (var row in allRows.Where(r => !r.IsActive))
        {
            row.EncryptedValues = null;
            row.Values = JsonDocument.Parse("{}");
        }

        // Im selben SaveChanges wie die neuen Schlüssel, damit ein Fehler nichts halb ersetzt.
        db.CustomTableKeys.RemoveRange(await db.CustomTableKeys.Where(k => k.TableId == table.Id).ToListAsync());
        db.CustomTableKeys.AddRange(keys.Select(k => new CustomTableKeyEntity
        {
            TableId = table.Id,
            VaultId = k.VaultId,
            WrappedKey = k.WrappedKey,
            GrantedById = userId,
            Granted = now,
        }));

        table.ModifierId = userId;
        table.Modified = now;
        return null;
    }

    private async Task SetKeyAsync(Guid tableId, Guid vaultId, string wrappedKey, Guid grantedBy)
    {
        var key = await db.CustomTableKeys.FirstOrDefaultAsync(k => k.TableId == tableId && k.VaultId == vaultId);
        if (key is null)
        {
            key = new CustomTableKeyEntity { TableId = tableId, VaultId = vaultId };
            db.CustomTableKeys.Add(key);
        }

        key.WrappedKey = wrappedKey;
        key.GrantedById = grantedBy;
        key.Granted = DateTimeOffset.UtcNow;
    }

    private async Task<bool> HasAccessAsync(Guid tableId)
    {
        var userId = ((Invoker)User).UserId;
        return await db.CustomTableKeys.AnyAsync(k => k.TableId == tableId && k.Vault!.UserId == userId);
    }

    private static bool IsValidCiphertext(string? value, int maxLength) =>
        !string.IsNullOrEmpty(value) && value.Length <= maxLength &&
        Convert.TryFromBase64String(value, new byte[value.Length], out var length) && length > 12;

    private ObjectResult KeyVersionConflict() =>
        Conflict("The table key has changed. Reload the table and try again.");
}

/// <param name="VaultId">Leer, solange der Benutzer keinen Tresor eingerichtet hat.</param>
public record TableAccessMemberDto(
    Guid UserId,
    string Name,
    string? Email,
    Guid? VaultId,
    string? PublicKey,
    bool HasAccess);

public record TableAccessDto(
    IList<TableAccessMemberDto> Members,
    Guid? RecoveryVaultId,
    string? RecoveryPublicKey,
    bool RecoveryHasAccess);

public record GrantTableAccessRequest(Guid UserId, string WrappedKey, int KeyVersion);

public record AddRecoveryKeyRequest(string WrappedKey, int KeyVersion);

public record VaultKeyDto(Guid VaultId, string WrappedKey);

public record EncryptedRowDto(Guid Id, string EncryptedValues);

/// <param name="Keys">Tabellenschlüssel je Tresor; mindestens der eigene und der Wiederherstellungs-Tresor.</param>
/// <param name="Rows">Alle aktiven Einträge, verschlüsselt.</param>
public record EncryptTableRequest(IList<VaultKeyDto> Keys, IList<EncryptedRowDto> Rows);

public record RotateTableKeyRequest(int BaseKeyVersion, IList<VaultKeyDto> Keys, IList<EncryptedRowDto> Rows);
