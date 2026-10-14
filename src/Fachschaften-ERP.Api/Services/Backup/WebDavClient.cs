using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;

namespace Fachschaften_ERP.Api.Services.Backup;

/// <summary>Datei oder Ordner auf dem WebDAV-Server.</summary>
public sealed record WebDavItem(string Name, Uri Href, bool IsFolder, DateTimeOffset? LastModified, long? Size);

public class WebDavException(string message, HttpStatusCode? status = null, Exception? inner = null)
    : Exception(message, inner)
{
    public HttpStatusCode? Status { get; } = status;
}

/// <summary>
/// Schlanker WebDAV-Client (z. B. für Nextcloud): Ordner auflisten, anlegen, Dateien hochladen
/// und löschen. Angelehnt an den Client aus dem IWI-Backend, ergänzt um schreibende Methoden.
/// </summary>
public sealed class WebDavClient
{
    private static readonly XNamespace D = "DAV:";
    private static readonly HttpMethod Propfind = new("PROPFIND");
    private static readonly HttpMethod Mkcol = new("MKCOL");

    private const string PropfindBody =
        """<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>""";

    private readonly HttpClient _http;

    /// <summary>Basis-Ordner; endet immer mit "/".</summary>
    public Uri Folder { get; }

    public WebDavClient(HttpClient http, string folderUrl, string? username, string? password)
    {
        _http = http;
        if (!Uri.TryCreate(folderUrl.Trim(), UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("https" or "http"))
            throw new WebDavException("Die WebDAV-Adresse ist ungültig (erwartet: https://…).");
        Folder = uri.AbsoluteUri.EndsWith('/') ? uri : new Uri(uri.AbsoluteUri + "/");

        if (!string.IsNullOrEmpty(username))
        {
            var token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", token);
        }
    }

    /// <summary>Prüft, ob der Ordner erreichbar ist, und legt ihn an, falls er fehlt.</summary>
    public async Task EnsureFolderAsync(CancellationToken ct = default)
    {
        using var probe = new HttpRequestMessage(Propfind, Folder);
        probe.Headers.Add("Depth", "0");
        probe.Content = new StringContent(PropfindBody, Encoding.UTF8, "application/xml");
        using var response = await SendAsync(probe, ct);
        if (response.IsSuccessStatusCode) return;
        if (response.StatusCode != HttpStatusCode.NotFound) throw Error("Ordner prüfen", response);

        using var create = new HttpRequestMessage(Mkcol, Folder);
        using var created = await SendAsync(create, ct);
        if (!created.IsSuccessStatusCode) throw Error("Ordner anlegen", created);
    }

    /// <summary>Inhalt des Ordners (Depth: 1) ohne den Ordner selbst.</summary>
    public async Task<IList<WebDavItem>> ListAsync(CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(Propfind, Folder);
        request.Headers.Add("Depth", "1");
        request.Content = new StringContent(PropfindBody, Encoding.UTF8, "application/xml");

        using var response = await SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw Error("Ordner auflisten", response); // erwartet: 207

        var doc = XDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var selfPath = Folder.AbsolutePath.TrimEnd('/');
        var items = new List<WebDavItem>();

        foreach (var r in doc.Descendants(D + "response"))
        {
            var rawHref = r.Element(D + "href")?.Value;
            if (string.IsNullOrEmpty(rawHref)) continue;

            var href = new Uri(Folder, rawHref);
            if (href.AbsolutePath.TrimEnd('/') == selfPath) continue;

            var name = Uri.UnescapeDataString(href.Segments[^1]).TrimEnd('/');
            if (string.IsNullOrEmpty(name)) continue;

            items.Add(new WebDavItem(
                name,
                href,
                r.Descendants(D + "collection").Any(),
                DateTimeOffset.TryParse(Prop(r, "getlastmodified"), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var modified) ? modified : null,
                long.TryParse(Prop(r, "getcontentlength"), out var size) ? size : null));
        }

        return items;
    }

    /// <summary>Lädt eine Datei in den Ordner hoch (überschreibt eine gleichnamige).</summary>
    public async Task UploadAsync(string fileName, Stream content, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, new Uri(Folder, Uri.EscapeDataString(fileName)));
        request.Content = new StreamContent(content);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        if (content.CanSeek) request.Content.Headers.ContentLength = content.Length - content.Position;

        using var response = await SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw Error("Hochladen", response);
    }

    public async Task DeleteAsync(Uri href, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, href);
        using var response = await SendAsync(request, ct);
        if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.NotFound)
            throw Error("Löschen", response);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try
        {
            return await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (HttpRequestException e)
        {
            throw new WebDavException($"Der WebDAV-Server ist nicht erreichbar: {e.Message}", null, e);
        }
    }

    private static WebDavException Error(string action, HttpResponseMessage response) =>
        response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => new WebDavException(
                "Anmeldung am WebDAV-Server fehlgeschlagen: Benutzername oder Passwort stimmen nicht.", response.StatusCode),
            HttpStatusCode.Forbidden => new WebDavException(
                $"{action}: keine Berechtigung für diesen Ordner.", response.StatusCode),
            HttpStatusCode.NotFound or HttpStatusCode.Conflict => new WebDavException(
                $"{action}: Der Ordner existiert nicht (übergeordnete Ordner werden nicht automatisch angelegt).",
                response.StatusCode),
            HttpStatusCode.InsufficientStorage => new WebDavException(
                $"{action}: Auf dem WebDAV-Speicher ist kein Platz mehr.", response.StatusCode),
            _ => new WebDavException(
                $"{action} fehlgeschlagen: {(int)response.StatusCode} {response.ReasonPhrase}", response.StatusCode),
        };

    private static string? Prop(XElement response, string name) =>
        response.Descendants(D + name).FirstOrDefault()?.Value;
}
