using System.Security.Cryptography;
using System.Text;
using Fachschaften_ERP.Models;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services.Documents;

/// <summary>
/// Hält die gemeinsamen Dateien der Vorlagen als Ordner auf der Platte vor. Pro Stand (welche
/// Dateien in welcher Fassung) gibt es einen Ordner; ändert sich etwas, entsteht ein neuer und
/// alte werden aufgeräumt. So lädt nicht jede Vorschau alle Dateien aus der Datenbank.
/// </summary>
public class PublicFilesCache(IConfiguration configuration, ILogger<PublicFilesCache> logger)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string CacheRoot =>
        configuration["Documents:PublicFilesCachePath"] ?? Path.Combine(Path.GetTempPath(), "erp-typst-public");

    /// <summary>Ordner mit allen gemeinsamen Dateien in ihren Unterordnern; null, wenn es keine gibt.</summary>
    public async Task<string?> GetDirectoryAsync(CoreContext db, CancellationToken ct)
    {
        var manifest = await db.DocumentPublicFiles
            .AsNoTracking()
            .OrderBy(f => f.Path)
            .Select(f => new { f.Id, f.Path, Stamp = f.Modified ?? f.Created })
            .ToListAsync(ct);
        if (manifest.Count == 0) return null;

        var key = Hash(string.Join('\n', manifest.Select(f => $"{f.Id}|{f.Path}|{f.Stamp.UtcTicks}")));
        var directory = Path.Combine(CacheRoot, key);
        if (Directory.Exists(directory)) return directory;

        await _gate.WaitAsync(ct);
        try
        {
            if (Directory.Exists(directory)) return directory;

            var staging = Path.Combine(CacheRoot, $"{key}.tmp-{Guid.NewGuid():N}");
            Directory.CreateDirectory(staging);
            foreach (var file in manifest)
            {
                var data = await db.DocumentPublicFiles.AsNoTracking()
                    .Where(f => f.Id == file.Id).Select(f => f.Data).FirstAsync(ct);
                var target = Path.Combine(staging, file.Path.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                await File.WriteAllBytesAsync(target, data, ct);
            }

            Directory.Move(staging, directory);
            CleanUp(key);
            return directory;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Ältere Stände löschen; etwas warten, falls gerade noch eine Übersetzung daraus kopiert.</summary>
    private void CleanUp(string currentKey)
    {
        foreach (var dir in new DirectoryInfo(CacheRoot).EnumerateDirectories())
        {
            if (dir.Name == currentKey || dir.LastWriteTimeUtc > DateTime.UtcNow.AddMinutes(-10)) continue;
            try
            {
                dir.Delete(recursive: true);
            }
            catch (IOException e)
            {
                logger.LogDebug(e, "Alter Stand {Path} ließ sich nicht löschen", dir.FullName);
            }
        }
    }

    private static string Hash(string text) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..20].ToLowerInvariant();
}
