namespace Fachschaften_ERP.Api.Services.Interfaces;

public class DevEmailSender(ILogger<DevEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body)
    {
        logger.LogInformation("Email to {To}\nSubject: {Subject}\n{Body}", to, subject, body);
        return Task.CompletedTask;
    }
}