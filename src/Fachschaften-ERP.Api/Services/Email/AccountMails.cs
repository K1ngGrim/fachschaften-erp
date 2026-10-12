using System.Net;
using System.Text;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Mails rund um Benutzerkonten: Einladung und Passwort zurücksetzen.</summary>
public class AccountMails(IEmailSender emailSender, IConfiguration config)
{
    private string BaseUrl => (config["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');

    public Task SendInviteAsync(IdentityUserEntity user, Guid inviteId, string token, CancellationToken cancellationToken)
    {
        var link = $"{BaseUrl}/accept-invite?inviteId={inviteId}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;

        return emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            "Du wurdest eingeladen",
            $"""
            <p>Hallo {WebUtility.HtmlEncode(name)},</p>
            <p>Du wurdest zum Fachschaften ERP eingeladen.</p>
            <p><a href="{link}">Jetzt Account aktivieren</a></p>
            <p>Der Link ist 7 Tage gültig.</p>
            """,
            $"""
            Hallo {name},

            Du wurdest zum Fachschaften ERP eingeladen. Aktiviere deinen Account hier:
            {link}

            Der Link ist 7 Tage gültig.
            """), cancellationToken);
    }

    public Task SendPasswordResetAsync(IdentityUserEntity user, string token, CancellationToken cancellationToken)
    {
        var link = $"{BaseUrl}/reset-password?userId={user.Id}&token={Encode(token)}";
        var name = user.DisplayName ?? user.Email ?? user.UserName ?? string.Empty;

        return emailSender.SendAsync(new EmailMessage(
            new EmailAddress(user.Email!, user.DisplayName),
            "Passwort zurücksetzen",
            $"""
            <p>Hallo {WebUtility.HtmlEncode(name)},</p>
            <p>für dein Konto im Fachschaften ERP wurde ein neues Passwort angefordert.</p>
            <p><a href="{link}">Neues Passwort festlegen</a></p>
            <p>Der Link ist 2 Stunden gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren;
            dein bisheriges Passwort bleibt dann bestehen.</p>
            """,
            $"""
            Hallo {name},

            für dein Konto im Fachschaften ERP wurde ein neues Passwort angefordert.
            Neues Passwort festlegen:
            {link}

            Der Link ist 2 Stunden gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren;
            dein bisheriges Passwort bleibt dann bestehen.
            """), cancellationToken);
    }

    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
}
