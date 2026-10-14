using System.Diagnostics;
using System.Net;
using System.Text;
using Fachschaften_ERP.Api.Services.Email;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using ICSharpCode.SharpZipLib.Zip;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fachschaften_ERP.Api.Services.Backup;

/// <summary>
/// Führt ein Backup aus: Datenbank-Dump (pg_dump) plus optional lesbare CSV-Dateien, als ZIP
/// (optional AES-256-verschlüsselt) per WebDAV hochgeladen. Alte Backups werden aufgeräumt.
/// </summary>
public class BackupService(
    CoreContext db,
    BackupCsvExporter csvExporter,
    IDataProtectionProvider dataProtection,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    IEmailSender emailSender,
    OrganizationSettingsService organizationSettings,
    ILogger<BackupService> logger)
{
    public const string FilePrefix = "erp-backup-";
    private const string ProtectorPurpose = "Fachschaften-ERP.Backup.Secrets";

    private IDataProtector Protector => dataProtection.CreateProtector(ProtectorPurpose);

    public string Protect(string secret) => Protector.Protect(secret);

    public string? Unprotect(string? protectedSecret)
    {
        if (string.IsNullOrEmpty(protectedSecret)) return null;
        try
        {
            return Protector.Unprotect(protectedSecret);
        }
        catch (Exception e)
        {
            // Passiert, wenn die Data-Protection-Schlüssel verloren gingen (z. B. ohne /keys-Volume).
            throw new InvalidOperationException(
                "Gespeicherte Zugangsdaten lassen sich nicht mehr entschlüsseln. Bitte Passwörter in den Backup-Einstellungen neu eingeben.", e);
        }
    }

    public TimeZoneInfo TimeZone => AppTimeZone.From(configuration);

    public async Task<BackupSettingsEntity> GetSettingsAsync(CancellationToken ct = default) =>
        await db.BackupSettings.FirstOrDefaultAsync(s => s.Id == BackupSettingsEntity.SingletonId, ct)
        ?? new BackupSettingsEntity();

    public WebDavClient CreateClient(string url, string? username, string? password) =>
        new(httpClientFactory.CreateClient(nameof(BackupService)), url, username, password);

    /// <summary>Führt den bereits angelegten Lauf aus und hält Ergebnis bzw. Fehler darin fest.</summary>
    public async Task ExecuteAsync(Guid runId, CancellationToken ct)
    {
        var run = await db.BackupRuns.FirstAsync(r => r.Id == runId, ct);
        var settings = await GetSettingsAsync(ct);
        var workDir = Directory.CreateTempSubdirectory("erp-backup-");

        try
        {
            if (string.IsNullOrWhiteSpace(settings.WebDavUrl))
                throw new InvalidOperationException("Es ist kein WebDAV-Ordner eingerichtet.");

            var local = TimeZoneInfo.ConvertTime(run.Started, TimeZone);
            var fileName = $"{FilePrefix}{local:yyyy-MM-dd_HHmm}.zip";
            var archive = Path.Combine(workDir.FullName, fileName);
            var dump = Path.Combine(workDir.FullName, "database.dump");

            await DumpDatabaseAsync(dump, ct);
            await WriteArchiveAsync(archive, dump, settings, local, ct);

            var client = CreateClient(settings.WebDavUrl, settings.Username, Unprotect(settings.ProtectedPassword));
            await client.EnsureFolderAsync(ct);
            await using (var stream = File.OpenRead(archive))
            {
                await client.UploadAsync(fileName, stream, ct);
            }

            var removed = await CleanUpAsync(client, settings.KeepCount, ct);

            run.Status = BackupStatus.Succeeded;
            run.FileName = fileName;
            run.SizeBytes = new FileInfo(archive).Length;
            run.Message = removed > 0 ? $"{removed} ältere Backups gelöscht." : null;
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogError(e, "Backup {RunId} fehlgeschlagen", runId);
            run.Status = BackupStatus.Failed;
            run.Message = Truncate(e.Message, 4000);
            await NotifyFailureAsync(settings, run, CancellationToken.None);
        }
        finally
        {
            run.Finished = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            try
            {
                workDir.Delete(recursive: true);
            }
            catch (IOException e)
            {
                logger.LogWarning(e, "Temporäres Backup-Verzeichnis {Path} ließ sich nicht löschen", workDir.FullName);
            }
        }
    }

    /// <summary>Prüft die Verbindung: Ordner erreichbar (wird ggf. angelegt) und auflistbar.</summary>
    public async Task<int> TestConnectionAsync(string url, string? username, string? password, CancellationToken ct)
    {
        var client = CreateClient(url, username, password);
        await client.EnsureFolderAsync(ct);
        var items = await client.ListAsync(ct);
        return items.Count(i => !i.IsFolder && IsBackupFile(i.Name));
    }

    private async Task DumpDatabaseAsync(string target, CancellationToken ct)
    {
        var connection = new NpgsqlConnectionStringBuilder(configuration.GetConnectionString("Database"));
        var start = new ProcessStartInfo(ResolvePgDump())
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
        };
        start.ArgumentList.Add($"--host={connection.Host}");
        start.ArgumentList.Add($"--port={connection.Port}");
        start.ArgumentList.Add($"--username={connection.Username}");
        start.ArgumentList.Add($"--dbname={connection.Database}");
        start.ArgumentList.Add("--format=custom");
        start.ArgumentList.Add("--no-owner");
        start.ArgumentList.Add($"--file={target}");
        // Passwort per Umgebung, damit es nicht in der Prozessliste steht.
        start.Environment["PGPASSWORD"] = connection.Password ?? string.Empty;

        Process process;
        try
        {
            process = Process.Start(start) ?? throw new InvalidOperationException("pg_dump ließ sich nicht starten.");
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            throw new InvalidOperationException(
                "pg_dump wurde nicht gefunden. Im Docker-Image ist es enthalten; lokal den PostgreSQL-Client " +
                "installieren (macOS: brew install libpq) oder Backup:PgDumpPath setzen.", e);
        }

        using (process)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromMinutes(30));
            var errors = process.StandardError.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            if (process.ExitCode != 0)
                throw new InvalidOperationException($"pg_dump ist fehlgeschlagen: {Truncate((await errors).Trim(), 1000)}");
        }
    }

    /// <summary>
    /// Pfad zu pg_dump: Backup:PgDumpPath, sonst aus dem PATH, sonst übliche Installationsorte.
    /// Homebrew installiert libpq "keg-only", also nicht im PATH; IDEs starten zudem oft mit kurzem PATH.
    /// </summary>
    private string ResolvePgDump()
    {
        var configured = configuration["Backup:PgDumpPath"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var fromPath = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(dir => Path.Combine(dir, "pg_dump"))
            .FirstOrDefault(File.Exists);
        if (fromPath is not null) return fromPath;

        string[] candidates =
        [
            "/opt/homebrew/opt/libpq/bin/pg_dump",
            "/usr/local/opt/libpq/bin/pg_dump",
            "/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump",
        ];
        return candidates.FirstOrDefault(File.Exists) ?? "pg_dump";
    }

    private async Task WriteArchiveAsync(
        string target,
        string dump,
        BackupSettingsEntity settings,
        DateTimeOffset local,
        CancellationToken ct)
    {
        var password = Unprotect(settings.ProtectedArchivePassword);
        var organization = (await organizationSettings.GetAsync(ct)).Name;

        await using var file = File.Create(target);
        await using var zip = new ZipOutputStream(file);
        zip.SetLevel(6);
        if (password is not null) zip.Password = password;

        async Task AddAsync(string name, Stream content)
        {
            var entry = new ZipEntry(name) { DateTime = local.DateTime };
            if (password is not null) entry.AESKeySize = 256;
            zip.PutNextEntry(entry);
            await content.CopyToAsync(zip, ct);
            zip.CloseEntry();
        }

        Task AddTextAsync(string name, string text, bool bom = false)
        {
            var bytes = new UTF8Encoding(bom).GetPreamble().Concat(Encoding.UTF8.GetBytes(text)).ToArray();
            return AddAsync(name, new MemoryStream(bytes));
        }

        await AddTextAsync("LIESMICH.txt", Readme(organization, local, settings.IncludeCsv));
        await using (var dumpStream = File.OpenRead(dump))
        {
            await AddAsync("database.dump", dumpStream);
        }

        if (settings.IncludeCsv)
        {
            await foreach (var (path, content) in csvExporter.ExportAsync(TimeZone, ct))
                await AddTextAsync(path, content, bom: path.EndsWith(".csv"));
        }

        zip.Finish();
    }

    /// <summary>Löscht die ältesten Backups, sodass höchstens <paramref name="keep"/> bleiben.</summary>
    private static async Task<int> CleanUpAsync(WebDavClient client, int keep, CancellationToken ct)
    {
        var old = (await client.ListAsync(ct))
            .Where(i => !i.IsFolder && IsBackupFile(i.Name))
            .OrderByDescending(i => i.Name, StringComparer.Ordinal) // Name enthält Datum und Uhrzeit
            .Skip(Math.Max(keep, 1))
            .ToList();
        foreach (var item in old) await client.DeleteAsync(item.Href, ct);
        return old.Count;
    }

    public static bool IsBackupFile(string name) =>
        name.StartsWith(FilePrefix, StringComparison.Ordinal) && name.EndsWith(".zip", StringComparison.Ordinal);

    private async Task NotifyFailureAsync(BackupSettingsEntity settings, BackupRunEntity run, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settings.NotifyEmail)) return;
        try
        {
            var organization = (await organizationSettings.GetAsync(ct)).Name;
            var when = TimeZoneInfo.ConvertTime(run.Started, TimeZone).ToString("dd.MM.yyyy HH:mm");
            await emailSender.SendAsync(new EmailMessage(
                new EmailAddress(settings.NotifyEmail),
                $"Backup fehlgeschlagen ({organization})",
                $"""
                <p>Das Backup vom {when} ist fehlgeschlagen:</p>
                <p><strong>{WebUtility.HtmlEncode(run.Message)}</strong></p>
                <p>Details stehen in den Einstellungen unter „Backup“.</p>
                """,
                $"Das Backup vom {when} ist fehlgeschlagen:\n\n{run.Message}\n\nDetails stehen in den Einstellungen unter „Backup“.",
                organization), ct);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Benachrichtigung über fehlgeschlagenes Backup ließ sich nicht senden");
        }
    }

    private static string Readme(string organization, DateTimeOffset local, bool includeCsv) =>
        $"""
        Backup von {organization}, erstellt am {local:dd.MM.yyyy} um {local:HH:mm} Uhr.

        Inhalt
        ------
        database.dump   Vollständige Datenbank (PostgreSQL, Format "custom").
        {(includeCsv ? "csv/            Lesbare Kopie der Daten für Excel (Semikolon, UTF-8).\nwiki/           Wiki-Seiten als Markdown." : "(Ohne CSV-Dateien erstellt.)")}

        Vertrauliche Tabellen sind Ende-zu-Ende-verschlüsselt und deshalb nur im
        Datenbank-Dump enthalten. Lesbar werden sie nach der Wiederherstellung mit
        einem Tresor mit Zugriff oder dem Wiederherstellungsschlüssel.

        Wiederherstellen
        ----------------
        Siehe deploy/README.md, Abschnitt "Backup wiederherstellen". Kurz:

          pg_restore --clean --if-exists --no-owner -d <Datenbank> database.dump

        """;

    private static string Truncate(string text, int max) => text.Length <= max ? text : text[..max];
}
