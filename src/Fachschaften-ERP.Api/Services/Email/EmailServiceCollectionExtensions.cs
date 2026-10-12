using Microsoft.Extensions.Options;

namespace Fachschaften_ERP.Api.Services.Email;

public static class EmailServiceCollectionExtensions
{
    /// <summary>
    /// Registriert den <see cref="IEmailSender"/> für <c>Email:Provider</c>.
    /// Ein weiterer Dienst braucht einen Wert in <see cref="EmailProvider"/>, eine Implementierung
    /// von <see cref="IEmailSender"/> und einen Fall in diesem Switch.
    /// </summary>
    public static IServiceCollection AddEmailSender(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(EmailOptions.SectionName);
        services.AddOptions<EmailOptions>()
            .Bind(section)
            .Validate(o => o.Provider == EmailProvider.Dev || !string.IsNullOrWhiteSpace(o.FromAddress),
                "Email:FromAddress is required.")
            .Validate(o => o.Provider != EmailProvider.Mailjet ||
                           (!string.IsNullOrWhiteSpace(o.Mailjet.ApiKey) && !string.IsNullOrWhiteSpace(o.Mailjet.SecretKey)),
                "Email:Mailjet:ApiKey and Email:Mailjet:SecretKey are required for the Mailjet provider.")
            .ValidateOnStart();

        services.AddScoped<AccountMails>();

        var provider = section.GetValue<EmailProvider?>(nameof(EmailOptions.Provider)) ?? EmailProvider.Dev;
        switch (provider)
        {
            case EmailProvider.Dev:
                services.AddScoped<IEmailSender, DevEmailSender>();
                break;

            case EmailProvider.Mailjet:
                services.AddHttpClient<IEmailSender, MailjetEmailSender>((sp, client) =>
                {
                    var options = sp.GetRequiredService<IOptions<EmailOptions>>().Value;
                    client.BaseAddress = new Uri(options.Mailjet.ApiBaseUrl.TrimEnd('/') + "/");
                    client.Timeout = TimeSpan.FromSeconds(15);
                });
                break;

            default:
                throw new InvalidOperationException($"Unknown email provider '{provider}'.");
        }

        return services;
    }
}
