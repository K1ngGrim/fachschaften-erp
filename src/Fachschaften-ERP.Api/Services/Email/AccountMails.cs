using System.Net;
using System.Text;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Mails rund um Benutzerkonten: Einladung und Passwort zurücksetzen.</summary>
public class AccountMails(IEmailSender emailSender, IConfiguration config, OrganizationSettingsService settings)
{
    private string BaseUrl => (config["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');

    public async Task SendInviteAsync(IdentityUserEntity user, Guid inviteId, string token, CancellationToken cancellationToken)
    {
        var organization = (await settings.GetAsync(cancellationToken)).Name;
        var link = $"{BaseUrl}/accept-invite?inviteId={inviteId}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;

        await emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            "Du wurdest eingeladen",
            $"""
            <p>Hallo {WebUtility.HtmlEncode(name)},</p>
            <p>Du wurdest zu {WebUtility.HtmlEncode(organization)} eingeladen.</p>
            <p><a href="{link}">Jetzt Account aktivieren</a></p>
            <p>Der Link ist 7 Tage gültig.</p>
            """,
            $"""
            Hallo {name},

            Du wurdest zu {organization} eingeladen. Aktiviere deinen Account hier:
            {link}

            Der Link ist 7 Tage gültig.
            """,
            organization), cancellationToken);
    }

    public async Task SendPasswordResetAsync(IdentityUserEntity user, string token, CancellationToken cancellationToken)
    {
        var organization = (await settings.GetAsync(cancellationToken)).Name;
        var link = $"{BaseUrl}/reset-password?userId={user.Id}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;

        await emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            "Passwort zurücksetzen",
            $"""
            <p>Hallo {WebUtility.HtmlEncode(name)},</p>
            <p>für dein Konto bei {WebUtility.HtmlEncode(organization)} wurde ein neues Passwort angefordert.</p>
            <p><a href="{link}">Neues Passwort festlegen</a></p>
            <p>Der Link ist 2 Stunden gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren;
            dein bisheriges Passwort bleibt dann bestehen.</p>
            """,
            $"""
            Hallo {name},

            für dein Konto bei {organization} wurde ein neues Passwort angefordert.
            Neues Passwort festlegen:
            {link}

            Der Link ist 2 Stunden gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren;
            dein bisheriges Passwort bleibt dann bestehen.
            """,
            organization), cancellationToken);
    }

    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
}
