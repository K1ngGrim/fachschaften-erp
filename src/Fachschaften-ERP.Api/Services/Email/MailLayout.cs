using System.Globalization;
using System.Net;
using System.Text;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Auftritt der Organisation in Mails (aus den Einstellungen).</summary>
/// <param name="LogoUrl">Öffentliche URL eines PNG/JPEG; ohne Logo erscheint ein Kürzel.</param>
/// <param name="Contact">Mehrzeiliger Kontaktblock (Verantwortliche Stelle aus den Datenschutz-Einstellungen).</param>
public record MailBrand(
    string Name,
    string? Subtitle,
    string AccentColor,
    string? LogoUrl,
    string? Contact,
    string AppUrl,
    string PrivacyUrl,
    string? ImprintUrl);

/// <summary>Inhalt einer Mail; Texte werden escaped, <see cref="BodyHtml"/> ist bereits HTML.</summary>
/// <param name="Preheader">Vorschautext, den Mail-Programme neben dem Betreff zeigen.</param>
/// <param name="Heading">Große Überschrift im farbigen Kopfbereich.</param>
/// <param name="Lead">Ein Satz unter der Überschrift.</param>
/// <param name="Notice">Hinweis im grauen Kasten, z. B. Gültigkeit des Links.</param>
/// <param name="FooterNote">Warum man die Mail bekommt.</param>
public record MailContent(
    string Preheader,
    string Heading,
    string Lead,
    string BodyHtml,
    string ButtonText,
    string ButtonUrl,
    string? Notice,
    string FooterNote);

/// <summary>
/// HTML-Gerüst für alle Account-Mails. Tabellen und Inline-Styles, weil Mail-Programme (vor allem
/// Outlook) weder Flexbox noch Stylesheets zuverlässig unterstützen. Keine externen Schriften oder
/// Tracking; das einzige nachgeladene Bild ist das eigene Logo.
/// </summary>
public static class MailLayout
{
    private const string FontStack =
        "Poppins, 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

    private const string Text = "#2b3a42";
    private const string Muted = "#6b7a83";
    private const string Border = "#e3e9ed";
    private const string Canvas = "#f1f4f6";

    public static string Render(MailBrand brand, MailContent content)
    {
        var accent = brand.AccentColor;
        var onAccent = ReadableTextOn(accent);
        var e = (string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

        var logo = brand.LogoUrl is not null
            ? $"""<img src="{e(brand.LogoUrl)}" alt="" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;" />"""
            : $"""
               <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                 <td width="40" height="40" align="center" valign="middle" bgcolor="{accent}"
                     style="width:40px;height:40px;border-radius:10px;background:{accent};color:{onAccent};font:700 16px/40px {FontStack};">{e(Initials(brand.Name))}</td>
               </tr></table>
               """;

        var subtitle = string.IsNullOrWhiteSpace(brand.Subtitle)
            ? string.Empty
            : $"""<div style="font:400 12px/1.4 {FontStack};color:{Muted};">{e(brand.Subtitle)}</div>""";

        var notice = content.Notice is null
            ? string.Empty
            : $"""
               <tr><td style="padding:0 40px 8px;">
                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                   <tr><td style="padding:14px 16px;background:{Canvas};border-left:4px solid {accent};border-radius:6px;font:400 14px/1.5 {FontStack};color:{Text};">{e(content.Notice)}</td></tr>
                 </table>
               </td></tr>
               """;

        var contact = string.IsNullOrWhiteSpace(brand.Contact)
            ? $"""<strong style="color:{Text};">{e(brand.Name)}</strong>"""
            : string.Join("<br />", brand.Contact.Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0)
                .Select((line, i) => i == 0 ? $"""<strong style="color:{Text};">{e(line)}</strong>""" : Linkify(line, accent)));

        var links = new StringBuilder($"""<a href="{e(brand.PrivacyUrl)}" style="color:{Muted};text-decoration:underline;">Datenschutz</a>""");
        if (!string.IsNullOrWhiteSpace(brand.ImprintUrl))
            links.Append($""" &nbsp;·&nbsp; <a href="{e(brand.ImprintUrl)}" style="color:{Muted};text-decoration:underline;">Impressum</a>""");
        links.Append($""" &nbsp;·&nbsp; <a href="{e(brand.AppUrl)}" style="color:{Muted};text-decoration:underline;">Zur Anwendung</a>""");

        return $$"""
            <!DOCTYPE html>
            <html lang="de" xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="color-scheme" content="light" />
              <meta name="supported-color-schemes" content="light" />
              <title>{{e(content.Heading)}}</title>
              <style>
                @media (max-width: 620px) {
                  .container { width: 100% !important; border-radius: 0 !important; }
                  .px { padding-left: 24px !important; padding-right: 24px !important; }
                  .heading { font-size: 26px !important; }
                }
              </style>
            </head>
            <body style="margin:0;padding:0;background:{{Canvas}};-webkit-text-size-adjust:100%;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{{e(content.Preheader)}}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{{Canvas}}" style="background:{{Canvas}};">
                <tr><td align="center" style="padding:32px 12px;">
                  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
                         style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid {{Border}};">

                    <tr><td class="px" style="padding:24px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td valign="middle" style="padding-right:14px;">{{logo}}</td>
                        <td valign="middle">
                          <div style="font:700 16px/1.3 {{FontStack}};color:{{Text}};">{{e(brand.Name)}}</div>
                          {{subtitle}}
                        </td>
                      </tr></table>
                    </td></tr>

                    <tr><td class="px" bgcolor="{{accent}}" style="background:{{accent}};padding:36px 40px 34px;">
                      <div class="heading" style="font:800 30px/1.15 {{FontStack}};color:{{onAccent}};text-transform:uppercase;letter-spacing:0.5px;">{{e(content.Heading)}}</div>
                      <div style="margin-top:12px;font:400 16px/1.55 {{FontStack}};color:{{onAccent}};">{{e(content.Lead)}}</div>
                    </td></tr>

                    <tr><td class="px" style="padding:32px 40px 8px;font:400 15px/1.65 {{FontStack}};color:{{Text}};">
                      {{content.BodyHtml}}
                    </td></tr>

                    <tr><td class="px" style="padding:12px 40px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td bgcolor="{{accent}}" style="border-radius:999px;background:{{accent}};">
                          <a href="{{e(content.ButtonUrl)}}" target="_blank"
                             style="display:inline-block;padding:14px 30px;font:600 15px/1 {{FontStack}};color:{{onAccent}};text-decoration:none;border-radius:999px;">{{e(content.ButtonText)}}&nbsp;&nbsp;&#8599;</a>
                        </td>
                      </tr></table>
                    </td></tr>

                    {{notice}}

                    <tr><td class="px" style="padding:16px 40px 32px;font:400 12px/1.6 {{FontStack}};color:{{Muted}};">
                      Funktioniert der Button nicht? Kopiere diesen Link in deinen Browser:<br />
                      <a href="{{e(content.ButtonUrl)}}" style="color:{{accent}};word-break:break-all;">{{e(content.ButtonUrl)}}</a>
                    </td></tr>

                    <tr><td class="px" bgcolor="{{Canvas}}" style="background:{{Canvas}};border-top:1px solid {{Border}};padding:24px 40px;font:400 12px/1.6 {{FontStack}};color:{{Muted}};">
                      <div style="color:{{accent}};font-size:10px;letter-spacing:6px;margin-bottom:12px;">&#9670;&#9670;&#9670;</div>
                      <div style="margin-bottom:14px;">{{contact}}</div>
                      <div style="margin-bottom:14px;">{{links}}</div>
                      <div>{{e(content.FooterNote)}}</div>
                    </td></tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }

    /// <summary>
    /// Textfarbe auf der Akzentfarbe wie im Frontend: Weiß, außer bei sehr hellen Farben
    /// (Kontrast zu Weiß unter 2,2:1).
    /// </summary>
    public static string ReadableTextOn(string hex)
    {
        double Channel(int offset)
        {
            var value = int.Parse(hex.AsSpan(offset, 2), NumberStyles.HexNumber) / 255.0;
            return value <= 0.03928 ? value / 12.92 : Math.Pow((value + 0.055) / 1.055, 2.4);
        }

        var luminance = 0.2126 * Channel(1) + 0.7152 * Channel(3) + 0.0722 * Channel(5);
        return 1.05 / (luminance + 0.05) >= 2.2 ? "#ffffff" : "#17120a";
    }

    /// <summary>Kürzel wie im Avatar der Anwendung, z. B. "Fachschaft IWI" → "FI".</summary>
    private static string Initials(string name)
    {
        var parts = name.Split([' ', '-', '_', '.'], StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => "?",
            1 => parts[0][..Math.Min(2, parts[0].Length)].ToUpperInvariant(),
            _ => $"{parts[0][0]}{parts[1][0]}".ToUpperInvariant(),
        };
    }

    /// <summary>Zeile des Kontaktblocks; E-Mail-Adressen und Webseiten werden zu Links.</summary>
    private static string Linkify(string line, string accent)
    {
        var encoded = WebUtility.HtmlEncode(line);
        if (line.Contains('@') && !line.Contains(' '))
            return $"""<a href="mailto:{encoded}" style="color:{accent};text-decoration:none;">{encoded}</a>""";
        if (line.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            line.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return $"""<a href="{encoded}" style="color:{accent};text-decoration:none;">{encoded}</a>""";
        return encoded;
    }
}
