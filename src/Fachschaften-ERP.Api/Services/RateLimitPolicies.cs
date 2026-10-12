using System.Threading.RateLimiting;

namespace Fachschaften_ERP.Api.Services;

public static class RateLimitPolicies
{
    /// <summary>Link zum Zurücksetzen anfordern: begrenzt den Mail-Versand pro IP.</summary>
    public const string PasswordResetRequest = "password-reset-request";

    /// <summary>Neues Passwort setzen: begrenzt das Durchprobieren von Tokens pro IP.</summary>
    public const string PasswordResetConfirm = "password-reset-confirm";

    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(PasswordResetRequest, context => PerIp(context, permitLimit: 5));
            options.AddPolicy(PasswordResetConfirm, context => PerIp(context, permitLimit: 20));
        });

    private static RateLimitPartition<string> PerIp(HttpContext context, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(15),
            });
}
