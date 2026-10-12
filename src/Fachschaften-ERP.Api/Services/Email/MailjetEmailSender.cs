using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Fachschaften_ERP.Api.Services.Email;

/// <summary>Versand über die Mailjet Send API v3.1 (https://dev.mailjet.com/email/guides/send-api-v31/).</summary>
public class MailjetEmailSender(
    HttpClient httpClient,
    IOptions<EmailOptions> options,
    ILogger<MailjetEmailSender> logger) : IEmailSender
{
    // Mailjet erwartet die Feldnamen in PascalCase.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var config = options.Value;

        var payload = new
        {
            config.Mailjet.SandboxMode,
            Messages = new[]
            {
                new
                {
                    From = new { Email = config.FromAddress, Name = config.FromName },
                    To = new[] { new { Email = message.To.Address, message.To.Name } },
                    message.Subject,
                    TextPart = message.TextBody,
                    HTMLPart = message.HtmlBody,
                },
            },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "v3.1/send");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{config.Mailjet.ApiKey}:{config.Mailjet.SecretKey}")));
        request.Content = JsonContent.Create(payload, options: JsonOptions);
        // Mit fester Content-Length statt chunked senden.
        await request.Content.LoadIntoBufferAsync(cancellationToken);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException e)
        {
            throw new EmailSendException("Mailjet is not reachable.", e);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode) return;

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogError("Mailjet rejected email to {To}: {StatusCode} {Body}",
                message.To.Address, (int)response.StatusCode, body);
            throw new EmailSendException($"Mailjet rejected the email ({(int)response.StatusCode}).");
        }
    }
}
