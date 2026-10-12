namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>
/// Versendet E-Mails über den in <c>Email:Provider</c> konfigurierten Dienst.
/// Neue Dienste implementieren dieses Interface und werden in
/// <see cref="EmailServiceCollectionExtensions.AddEmailSender"/> registriert.
/// </summary>
public interface IEmailSender
{
    /// <exception cref="EmailSendException">Der Dienst hat die Mail nicht angenommen.</exception>
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

public record EmailAddress(string Address, string? Name = null);

/// <param name="HtmlBody">Inhalt als HTML.</param>
/// <param name="TextBody">Optionaler Klartext für Mail-Clients ohne HTML.</param>
public record EmailMessage(EmailAddress To, string Subject, string HtmlBody, string? TextBody = null);

public class EmailSendException(string message, Exception? innerException = null)
    : Exception(message, innerException);
