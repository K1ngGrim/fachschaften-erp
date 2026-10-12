namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Konfiguration aus dem Abschnitt <c>Email</c>.</summary>
public class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>Welcher Dienst die Mails verschickt, siehe <see cref="EmailProvider"/>.</summary>
    public EmailProvider Provider { get; set; } = EmailProvider.Dev;

    /// <summary>Absenderadresse; muss beim Dienst als Absender freigegeben sein.</summary>
    public string FromAddress { get; set; } = string.Empty;

    public string? FromName { get; set; }

    public MailjetOptions Mailjet { get; set; } = new();
}

public enum EmailProvider
{
    /// <summary>Mails nur ins Log schreiben.</summary>
    Dev,
    Mailjet,
}

public class MailjetOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>Mailjet prüft die Mail nur, verschickt sie aber nicht.</summary>
    public bool SandboxMode { get; set; }

    public string ApiBaseUrl { get; set; } = "https://api.mailjet.com";
}
