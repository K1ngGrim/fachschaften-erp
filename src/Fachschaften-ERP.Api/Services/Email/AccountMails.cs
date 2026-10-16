using System.Net;
using System.Text;
using Fachschaften_ERP.Models.Entities;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Mails rund um Benutzerkonten: Einladung und Passwort zurücksetzen.</summary>
public class AccountMails(
    IEmailSender emailSender,
    IConfiguration config,
    OrganizationSettingsService settings,
    MailLogo mailLogo)
{
    private string BaseUrl => (config["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');

    public async Task SendInviteAsync(
        IdentityUserEntity user,
        Guid inviteId,
        string token,
        bool require2Fa,
        CancellationToken cancellationToken)
    {
        var organization = await settings.GetAsync(cancellationToken);
        var brand = await BrandAsync(organization, cancellationToken);
        var link = $"{BaseUrl}/accept-invite?inviteId={inviteId}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;
        var login = user.Email ?? user.UserName ?? string.Empty;
        var e = (string s) => WebUtility.HtmlEncode(s);

        var steps = new List<string> { "Auf „Zugang aktivieren“ klicken.", "Ein eigenes Passwort festlegen." };
        if (require2Fa) steps.Add("Die Zwei-Faktor-Anmeldung mit einer Authenticator-App einrichten.");
        steps.Add($"Fertig: Ab dann meldest du dich mit {login} an.");

        var html = MailLayout.Render(brand, new MailContent(
            Preheader: $"{organization.Name} hat dich eingeladen. Der Link ist 7 Tage gültig.",
            Heading: "Du bist eingeladen",
            Lead: $"Willkommen bei {organization.Name}! Aktiviere deinen Zugang, dann kann es losgehen.",
            BodyHtml: $"""
                <p style="margin:0 0 16px;">Hallo {e(name)},</p>
                <p style="margin:0 0 16px;">du wurdest eingeladen, bei <strong>{e(organization.Name)}</strong> mitzumachen.
                Hier organisiert die Fachschaft gemeinsam Lager und Verkauf, Kasse und Finanzen, Dokumente
                und alles, was sonst so anfällt.</p>
                <p style="margin:0 0 8px;"><strong>So geht’s:</strong></p>
                {Steps(steps, brand.AccentColor)}
                """,
            ButtonText: "Zugang aktivieren",
            ButtonUrl: link,
            Notice: "Der Link ist 7 Tage gültig. Ist er abgelaufen, kann dir die Person, die dich eingeladen hat, eine neue Einladung schicken.",
            FooterNote: $"Du bekommst diese Mail, weil dich jemand aus {organization.Name} eingeladen hat. Kannst du damit nichts anfangen, ignoriere sie einfach; ohne Aktivierung passiert nichts weiter."));

        var text = $"""
            Hallo {name},

            du wurdest eingeladen, bei {organization.Name} mitzumachen.

            So geht's:
            {string.Join("\n", steps.Select((s, i) => $"{i + 1}. {s}"))}

            Zugang aktivieren:
            {link}

            Der Link ist 7 Tage gültig. Ist er abgelaufen, kann dir die Person, die dich eingeladen hat,
            eine neue Einladung schicken.

            --
            {organization.Name}
            {organization.PrivacyContact}
            """;

        await emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            $"Einladung zu {organization.Name}",
            html,
            text,
            organization.Name), cancellationToken);
    }

    public async Task SendPasswordResetAsync(IdentityUserEntity user, string token, CancellationToken cancellationToken)
    {
        var organization = await settings.GetAsync(cancellationToken);
        var brand = await BrandAsync(organization, cancellationToken);
        var link = $"{BaseUrl}/reset-password?userId={user.Id}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;

        var html = MailLayout.Render(brand, new MailContent(
            Preheader: "Lege ein neues Passwort fest. Der Link ist 2 Stunden gültig.",
            Heading: "Neues Passwort",
            Lead: $"Für dein Konto bei {organization.Name} wurde ein neues Passwort angefordert.",
            BodyHtml: $"""
                <p style="margin:0 0 16px;">Hallo {WebUtility.HtmlEncode(name)},</p>
                <p style="margin:0;">über den Button legst du ein neues Passwort fest. Danach meldest du
                dich wie gewohnt an.</p>
                """,
            ButtonText: "Neues Passwort festlegen",
            ButtonUrl: link,
            Notice: "Der Link ist 2 Stunden gültig. Warst du das nicht, ignoriere diese Mail einfach; dein bisheriges Passwort bleibt bestehen.",
            FooterNote: $"Du bekommst diese Mail, weil für dein Konto bei {organization.Name} ein neues Passwort angefordert wurde."));

        var text = $"""
            Hallo {name},

            für dein Konto bei {organization.Name} wurde ein neues Passwort angefordert.
            Neues Passwort festlegen:
            {link}

            Der Link ist 2 Stunden gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren;
            dein bisheriges Passwort bleibt dann bestehen.
            """;

        await emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            "Passwort zurücksetzen",
            html,
            text,
            organization.Name), cancellationToken);
    }

    /// <summary>Auftritt aus den Einstellungen; das Logo nur, wenn es sich als PNG/JPEG ausliefern lässt.</summary>
    public async Task<MailBrand> BrandAsync(OrganizationSettingsEntity organization, CancellationToken ct)
    {
        string? logoUrl = null;
        if (organization.LogoDataUrl is { } dataUrl && await mailLogo.GetAsync(dataUrl, ct) is not null)
            logoUrl = $"{BaseUrl}/api/settings/organization/logo?v={MailLogo.Version(dataUrl)}";

        return new MailBrand(
            organization.Name,
            organization.Subtitle,
            organization.AccentColor,
            logoUrl,
            organization.PrivacyContact,
            BaseUrl,
            $"{BaseUrl}/datenschutz",
            organization.ImprintUrl);
    }

    /// <summary>Nummerierte Schritte mit Kreisen in der Akzentfarbe (Tabellen statt Liste: in Mails verlässlicher).</summary>
    private static string Steps(IEnumerable<string> steps, string accent)
    {
        var onAccent = MailLayout.ReadableTextOn(accent);
        var rows = steps.Select((step, i) => $"""
            <tr>
              <td valign="top" width="34" style="padding:0 0 10px;">
                <div style="width:24px;height:24px;border-radius:12px;background:{accent};color:{onAccent};font:700 12px/24px Poppins,'Segoe UI',Helvetica,Arial,sans-serif;text-align:center;">{i + 1}</div>
              </td>
              <td valign="top" style="padding:2px 0 10px;">{WebUtility.HtmlEncode(step)}</td>
            </tr>
            """);
        return $"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">{string.Concat(rows)}</table>""";
    }

    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
}
