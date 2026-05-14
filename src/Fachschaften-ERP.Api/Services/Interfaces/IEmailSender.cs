namespace Fachschaften_ERP.Api.Services.Interfaces;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}