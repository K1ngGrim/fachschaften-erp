using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services;

public static class UserManagerExtensions
{
    /// <summary>
    /// Sucht per Benutzername oder E-Mail. E-Mails sind nicht zwingend eindeutig; bei mehreren
    /// Treffern gibt es bewusst keinen Benutzer, statt einen falschen zu nehmen.
    /// </summary>
    public static async Task<IdentityUserEntity?> FindByUserNameOrEmailAsync(
        this UserManager<IdentityUserEntity> userManager,
        string login)
    {
        if (string.IsNullOrWhiteSpace(login)) return null;
        login = login.Trim();

        var user = await userManager.FindByNameAsync(login);
        if (user is not null) return user;

        var normalizedEmail = userManager.NormalizeEmail(login);
        var matches = await userManager.Users
            .Where(u => u.NormalizedEmail == normalizedEmail)
            .Take(2)
            .ToListAsync();

        return matches.Count == 1 ? matches[0] : null;
    }
}
