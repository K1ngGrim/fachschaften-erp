using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Backup;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>Backup per WebDAV: Einstellungen, Verbindungstest, manueller Start und Verlauf.</summary>
[ApiController]
[Route("/api/backup")]
[RequirePermission(PermissionType.SettingsWrite)]
public class BackupController(CoreContext db, BackupService backupService, BackupRunner runner) : ControllerBase
{
    /// <summary>Einstellungen; Passwörter werden nie zurückgegeben, nur ob eines gesetzt ist.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<BackupSettingsDto>> GetSettings() =>
        Ok(ToDto(await backupService.GetSettingsAsync()));

    /// <param name="request">
    /// Passwörter: null lässt das gespeicherte unverändert, ein leerer Text entfernt es.
    /// </param>
    [HttpPut("settings")]
    public async Task<ActionResult<BackupSettingsDto>> SaveSettings(SaveBackupSettingsRequest request)
    {
        if (!TimeOnly.TryParseExact(request.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return BadRequest("Time must be HH:mm.");
        if (request.KeepCount is < 1 or > 365) return BadRequest("KeepCount must be between 1 and 365.");

        var url = string.IsNullOrWhiteSpace(request.WebDavUrl) ? null : request.WebDavUrl.Trim();
        if (url is not null && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")))
            return BadRequest("WebDavUrl must be an http(s) URL.");
        if (request.Enabled && url is null) return BadRequest("A WebDAV folder is required.");

        var email = string.IsNullOrWhiteSpace(request.NotifyEmail) ? null : request.NotifyEmail.Trim();
        if (email is not null && !new EmailAddressAttribute().IsValid(email)) return BadRequest("Invalid email address.");
        if (request.Password?.Length > 500 || request.ArchivePassword?.Length > 500) return BadRequest("Password is too long.");

        var settings = await db.BackupSettings.FirstOrDefaultAsync(s => s.Id == BackupSettingsEntity.SingletonId);
        if (settings is null)
        {
            settings = new BackupSettingsEntity();
            db.BackupSettings.Add(settings);
        }

        settings.Enabled = request.Enabled;
        settings.WebDavUrl = url;
        settings.Username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim();
        if (request.Password is not null)
            settings.ProtectedPassword = request.Password.Length == 0 ? null : backupService.Protect(request.Password);
        settings.Time = time;
        settings.KeepCount = request.KeepCount;
        settings.IncludeCsv = request.IncludeCsv;
        if (request.ArchivePassword is not null)
        {
            settings.ProtectedArchivePassword =
                request.ArchivePassword.Length == 0 ? null : backupService.Protect(request.ArchivePassword);
        }
        settings.NotifyEmail = email;
        settings.ModifierId = ((Invoker)User).UserId;
        settings.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Ok(ToDto(settings));
    }

    /// <summary>
    /// Prüft die Verbindung mit den übergebenen Daten; ohne Passwort wird das gespeicherte verwendet.
    /// Legt den Ordner an, falls er fehlt.
    /// </summary>
    [HttpPost("test")]
    public async Task<ActionResult<BackupTestResultDto>> Test(TestBackupConnectionRequest request, CancellationToken ct)
    {
        try
        {
            var password = request.Password ??
                           backupService.Unprotect((await backupService.GetSettingsAsync(ct)).ProtectedPassword);
            var count = await backupService.TestConnectionAsync(request.WebDavUrl, request.Username, password, ct);
            return Ok(new BackupTestResultDto(true, count == 1
                ? "Verbindung klappt. Im Ordner liegt 1 Backup."
                : $"Verbindung klappt. Im Ordner liegen {count} Backups."));
        }
        catch (Exception e) when (e is WebDavException or InvalidOperationException)
        {
            return Ok(new BackupTestResultDto(false, e.Message));
        }
    }

    /// <summary>Startet ein Backup im Hintergrund; 409, wenn schon eines läuft.</summary>
    [HttpPost("run")]
    public async Task<ActionResult<BackupRunDto>> Run()
    {
        var settings = await backupService.GetSettingsAsync();
        if (string.IsNullOrWhiteSpace(settings.WebDavUrl)) return BadRequest("No WebDAV folder is configured.");

        var runId = await runner.StartAsync(BackupTrigger.Manual, ((Invoker)User).UserId);
        if (runId is null) return Conflict("A backup is already running.");

        var run = await db.BackupRuns.AsNoTracking().FirstAsync(r => r.Id == runId);
        return Accepted(ToDto(run, []));
    }

    /// <summary>Die letzten Läufe, neueste zuerst.</summary>
    [HttpGet("runs")]
    public async Task<ActionResult<IList<BackupRunDto>>> GetRuns()
    {
        var runs = await db.BackupRuns.AsNoTracking().OrderByDescending(r => r.Started).Take(20).ToListAsync();
        var userIds = runs.Where(r => r.TriggeredById is not null).Select(r => r.TriggeredById!.Value).Distinct().ToList();
        var names = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.UserName ?? string.Empty);
        return Ok(runs.Select(r => ToDto(r, names)).ToList());
    }

    private BackupSettingsDto ToDto(BackupSettingsEntity s)
    {
        DateTimeOffset? next = null;
        if (s.Enabled)
        {
            var last = BackupRunner.LastScheduledTime(s.Time, backupService.TimeZone, DateTimeOffset.UtcNow);
            next = last.AddDays(1);
        }

        return new BackupSettingsDto(s.Enabled, s.WebDavUrl, s.Username, s.ProtectedPassword is not null,
            s.Time.ToString("HH:mm", CultureInfo.InvariantCulture), s.KeepCount, s.IncludeCsv,
            s.ProtectedArchivePassword is not null, s.NotifyEmail, backupService.TimeZone.Id, next, runner.IsRunning);
    }

    private static BackupRunDto ToDto(BackupRunEntity r, Dictionary<Guid, string> names) =>
        new(r.Id, r.Trigger, r.Status, r.Started, r.Finished, r.FileName, r.SizeBytes, r.Message,
            r.TriggeredById is { } id ? names.GetValueOrDefault(id) : null);
}

/// <param name="NextRun">Nächstes planmäßiges Backup (nur wenn aktiviert).</param>
public record BackupSettingsDto(
    bool Enabled,
    string? WebDavUrl,
    string? Username,
    bool HasPassword,
    string Time,
    int KeepCount,
    bool IncludeCsv,
    bool HasArchivePassword,
    string? NotifyEmail,
    string TimeZone,
    DateTimeOffset? NextRun,
    bool IsRunning);

/// <param name="Password">null: unverändert; leer: entfernen.</param>
/// <param name="ArchivePassword">null: unverändert; leer: Backups unverschlüsselt.</param>
public record SaveBackupSettingsRequest(
    bool Enabled,
    string? WebDavUrl,
    string? Username,
    string? Password,
    string Time,
    int KeepCount,
    bool IncludeCsv,
    string? ArchivePassword,
    string? NotifyEmail);

/// <param name="Password">null: gespeichertes Passwort verwenden.</param>
public record TestBackupConnectionRequest(string WebDavUrl, string? Username, string? Password);

public record BackupTestResultDto(bool Success, string Message);

public record BackupRunDto(
    Guid Id,
    BackupTrigger Trigger,
    BackupStatus Status,
    DateTimeOffset Started,
    DateTimeOffset? Finished,
    string? FileName,
    long? SizeBytes,
    string? Message,
    string? TriggeredBy);
