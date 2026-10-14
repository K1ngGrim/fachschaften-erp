using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace Fachschaften_ERP.Api.Services.Documents;

/// <summary>Typst konnte das Dokument nicht erzeugen; die Meldung ist für Vorlagen-Autor:innen gedacht.</summary>
public class TypstException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>
/// Übersetzt Typst-Quelltext mit dem typst-CLI zu PDF. Jede Übersetzung läuft in einem eigenen
/// temporären Ordner, der zugleich Wurzel ist: Typst liest nur Dateien darin, hat keinen
/// Shell-Zugriff und lädt höchstens Pakete aus dem offiziellen Paketverzeichnis.
/// <code>
/// &lt;wurzel&gt;/work/      main.typ, data.json, Dateien der Vorlage
/// &lt;wurzel&gt;/template/  gemeinsame Dateien mit Unterordnern, z. B. /template/logos/fs.png
/// </code>
/// </summary>
public partial class TypstCompiler(IConfiguration configuration, ILogger<TypstCompiler> logger)
{
    /// <summary>Höchstens zwei Übersetzungen gleichzeitig, damit eine Vorlage den Server nicht auslastet.</summary>
    private static readonly SemaphoreSlim Gate = new(2, 2);

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(20);

    /// <summary>Ohne BOM: Typst liest data.json sonst nicht als JSON.</summary>
    private static readonly UTF8Encoding Utf8 = new(encoderShouldEmitUTF8Identifier: false);
    private const long MaxPdfBytes = 20 * 1024 * 1024;

    public async Task<byte[]> CompileAsync(
        string source,
        IEnumerable<(string FileName, byte[] Data)> assets,
        string dataJson,
        string? publicDirectory,
        CancellationToken ct)
    {
        if (!await Gate.WaitAsync(TimeSpan.FromSeconds(30), ct))
            throw new TypstException("Gerade werden viele Dokumente erzeugt. Bitte versuche es gleich noch einmal.");

        var dir = Directory.CreateTempSubdirectory("erp-typst-");
        try
        {
            var work = Directory.CreateDirectory(Path.Combine(dir.FullName, "work")).FullName;
            foreach (var (fileName, data) in assets)
                await File.WriteAllBytesAsync(Path.Combine(work, Path.GetFileName(fileName)), data, ct);
            await File.WriteAllTextAsync(Path.Combine(work, "data.json"), dataJson, Utf8, ct);
            await File.WriteAllTextAsync(Path.Combine(work, "main.typ"), source, Utf8, ct);
            if (publicDirectory is not null) CopyDirectory(publicDirectory, Path.Combine(dir.FullName, "template"));

            var output = Path.Combine(dir.FullName, "output.pdf");
            await RunAsync(dir.FullName, output, ct);

            var info = new FileInfo(output);
            if (!info.Exists) throw new TypstException("Typst hat kein PDF erzeugt.");
            if (info.Length > MaxPdfBytes) throw new TypstException("Das erzeugte PDF ist größer als 20 MB.");
            return await File.ReadAllBytesAsync(output, ct);
        }
        finally
        {
            Gate.Release();
            try
            {
                dir.Delete(recursive: true);
            }
            catch (IOException e)
            {
                logger.LogWarning(e, "Temporärer Typst-Ordner {Path} ließ sich nicht löschen", dir.FullName);
            }
        }
    }

    private async Task RunAsync(string root, string output, CancellationToken ct)
    {
        var start = new ProcessStartInfo(ResolveTypst())
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            WorkingDirectory = root,
        };
        foreach (var arg in new[]
                 {
                     "compile", "--root", root, "--font-path", root, "--diagnostic-format", "short",
                     Path.Combine(root, "work", "main.typ"), output,
                 })
            start.ArgumentList.Add(arg);
        // Paket-Cache an einen beschreibbaren Ort (im Container hat der App-Benutzer kein Home).
        start.Environment["TYPST_PACKAGE_CACHE_PATH"] =
            configuration["Documents:PackageCachePath"] ?? Path.Combine(Path.GetTempPath(), "typst-packages");

        Process process;
        try
        {
            process = Process.Start(start) ?? throw new TypstException("Typst ließ sich nicht starten.");
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            throw new TypstException(
                "Typst wurde auf dem Server nicht gefunden. Im Docker-Image ist es enthalten; lokal installieren " +
                "(macOS: brew install typst) oder Documents:TypstPath setzen.", e);
        }

        using (process)
        {
            var stderr = process.StandardError.ReadToEndAsync(ct);
            var stdout = process.StandardOutput.ReadToEndAsync(ct);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(Timeout);
            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                process.Kill(entireProcessTree: true);
                throw new TypstException(
                    $"Das Übersetzen hat länger als {Timeout.TotalSeconds:0} Sekunden gedauert und wurde abgebrochen.");
            }

            if (process.ExitCode != 0)
            {
                var message = CleanDiagnostics((await stderr) + (await stdout), root);
                throw new TypstException(string.IsNullOrWhiteSpace(message) ? "Typst ist fehlgeschlagen." : message);
            }
        }
    }

    /// <summary>Temporären Pfad entfernen und Länge begrenzen, damit Meldungen lesbar bleiben.</summary>
    private static string CleanDiagnostics(string text, string root)
    {
        text = AnsiEscape().Replace(text, string.Empty);
        // macOS meldet temporäre Pfade mit /private davor; beide Formen entfernen. Dateien der Vorlage
        // erscheinen so als "main.typ", gemeinsame als "template/…".
        foreach (var prefix in new[] { "/private" + root, root })
        {
            var work = prefix + Path.DirectorySeparatorChar + "work" + Path.DirectorySeparatorChar;
            text = text.Replace(work, string.Empty)
                .Replace(prefix + Path.DirectorySeparatorChar, string.Empty)
                .Replace(prefix, string.Empty);
        }
        // Typst nennt Dateien relativ zur Wurzel ("work/main.typ:3:1: …"); am Zeilenanfang kürzen.
        text = WorkPrefix().Replace(text, string.Empty);
        text = text.Trim();
        return text.Length > 3000 ? text[..3000] + " …" : text;
    }

    private static void CopyDirectory(string source, string target)
    {
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var destination = Path.Combine(target, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination);
        }
    }

    private string ResolveTypst()
    {
        var configured = configuration["Documents:TypstPath"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var fromPath = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(dir => Path.Combine(dir, "typst"))
            .FirstOrDefault(File.Exists);
        if (fromPath is not null) return fromPath;

        string[] candidates = ["/opt/homebrew/bin/typst", "/usr/local/bin/typst"];
        return candidates.FirstOrDefault(File.Exists) ?? "typst";
    }

    [GeneratedRegex(@"\x1B\[[0-9;]*m")]
    private static partial Regex AnsiEscape();

    [GeneratedRegex(@"(?m)^work[/\\]")]
    private static partial Regex WorkPrefix();
}
