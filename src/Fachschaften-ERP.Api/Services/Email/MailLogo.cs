using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Fachschaften_ERP.Api.Services.Documents;
using Microsoft.Extensions.Caching.Memory;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>
/// Logo der Organisation in einer Form, die Mail-Programme anzeigen: PNG oder JPEG über eine
/// normale URL. Eingebettete data:-Bilder und SVG zeigen viele Clients (z. B. Gmail, Outlook)
/// nicht an; SVG und WebP werden deshalb mit Typst in ein PNG umgewandelt.
/// </summary>
public partial class MailLogo(TypstCompiler typst, IMemoryCache cache, ILogger<MailLogo> logger)
{
    public async Task<(byte[] Data, string ContentType)?> GetAsync(string? dataUrl, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(dataUrl)) return null;
        var match = DataUrl().Match(dataUrl);
        if (!match.Success) return null;

        var type = match.Groups["type"].Value;
        var bytes = Convert.FromBase64String(match.Groups["data"].Value);
        if (type is "png" or "jpeg") return (bytes, $"image/{type}");

        var key = $"mail-logo:{Version(dataUrl)}";
        if (cache.TryGetValue(key, out byte[]? png)) return png is null ? null : (png, "image/png");

        try
        {
            var extension = type == "svg+xml" ? "svg" : type;
            png = await typst.RenderPngAsync(
                $"#set page(width: auto, height: auto, margin: 0pt, fill: none)\n#image(\"logo.{extension}\", height: 1.5cm)",
                [($"logo.{extension}", bytes)], ct);
        }
        catch (TypstException e)
        {
            logger.LogWarning("Logo für E-Mails ließ sich nicht umwandeln: {Message}", e.Message);
            png = null;
        }

        // Fehlschläge kürzer merken, damit ein behobenes Problem bald wirkt.
        cache.Set(key, png, png is null ? TimeSpan.FromMinutes(10) : TimeSpan.FromDays(1));
        return png is null ? null : (png, "image/png");
    }

    /// <summary>Kurzer Fingerabdruck des Logos, damit Mail-Clients nach einer Änderung neu laden.</summary>
    public static string Version(string dataUrl) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(dataUrl)))[..12].ToLowerInvariant();

    [GeneratedRegex(@"^data:image/(?<type>png|jpeg|webp|svg\+xml);base64,(?<data>[A-Za-z0-9+/]+={0,2})$")]
    private static partial Regex DataUrl();
}
