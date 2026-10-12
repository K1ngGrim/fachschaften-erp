namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Schreibt Mails nur ins Log. Für die lokale Entwicklung (<c>Email:Provider = Dev</c>).</summary>
public class DevEmailSender(ILogger<DevEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Email to {To}\nSubject: {Subject}\n{Body}",
            message.To.Address, message.Subject, message.HtmlBody);
        return Task.CompletedTask;
    }
}
