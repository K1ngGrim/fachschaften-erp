using System.Security.Claims;
using System.Security.Cryptography;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services;

public static class DatabaseSeeder
{
    /// <summary>Markiert Konten, die vor der weiteren Nutzung ein eigenes Passwort setzen müssen.</summary>
    public const string PasswordChangeRequiredClaim = "password-change-required";

    /// <summary>Hat immer alle Rechte; darf weder gelöscht noch eingeschränkt werden.</summary>
    public const string AdminRoleName = "Admin";

    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRoleEntity>>();
        var userManager = services.GetRequiredService<UserManager<IdentityUserEntity>>();
        var config = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseSeeder));

        await SeedRolesAsync(roleManager);
        await SeedAdminUserAsync(userManager, config, logger);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRoleEntity> roleManager)
    {
        var roles = new Dictionary<string, string[]>
        {
            [AdminRoleName] = Permissions.All.ToArray(),
        };

        foreach (var (roleName, permissions) in roles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
                await roleManager.CreateAsync(new IdentityRoleEntity { Name = roleName });

            var role = await roleManager.FindByNameAsync(roleName);
            var existingClaims = await roleManager.GetClaimsAsync(role!);

            foreach (var permission in permissions)
            {
                if (!existingClaims.Any(c => c.Type == "permission" && c.Value == permission))
                    await roleManager.AddClaimAsync(role!, new Claim("permission", permission));
            }
        }
    }

    /// <summary>
    /// Legt beim ersten Start (noch kein Benutzer vorhanden) einen Admin an. Ohne
    /// <c>Seed:AdminPassword</c> wird ein Zufallspasswort erzeugt und einmalig geloggt.
    /// Beim ersten Login muss das Passwort geändert werden.
    /// </summary>
    private static async Task SeedAdminUserAsync(
        UserManager<IdentityUserEntity> userManager,
        IConfiguration config,
        ILogger logger)
    {
        if (await userManager.Users.AnyAsync()) return;

        var adminUserName = config["Seed:AdminUserName"] ?? "admin";
        var configuredPassword = config["Seed:AdminPassword"];
        var adminEmail = config["Seed:AdminEmail"];
        var admin = new IdentityUserEntity
        {
            UserName = adminUserName,
            Email = string.IsNullOrWhiteSpace(adminEmail) ? null : adminEmail,
        };
        if (!string.IsNullOrEmpty(configuredPassword) && !await IsValidPasswordAsync(userManager, admin, configuredPassword))
        {
            logger.LogWarning("Seed:AdminPassword does not satisfy the password policy; generating a password instead.");
            configuredPassword = null;
        }

        var adminPassword = string.IsNullOrEmpty(configuredPassword)
            ? await GeneratePasswordAsync(userManager, admin)
            : configuredPassword;

        var result = await userManager.CreateAsync(admin, adminPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                $"Admin user could not be created: {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(admin, AdminRoleName);
        await userManager.AddClaimAsync(admin, new Claim("custom", PasswordChangeRequiredClaim));

        if (string.IsNullOrEmpty(configuredPassword))
            logger.LogWarning(
                "Created initial admin user '{UserName}' with password '{Password}'. It must be changed on first login.",
                adminUserName, adminPassword);
        else
            logger.LogInformation(
                "Created initial admin user '{UserName}' with the configured password. It must be changed on first login.",
                adminUserName);
    }

    /// <summary>Zufallspasswort, das die konfigurierten Passwortregeln erfüllt.</summary>
    private static async Task<string> GeneratePasswordAsync(
        UserManager<IdentityUserEntity> userManager,
        IdentityUserEntity user)
    {
        const string alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_!?";
        var length = Math.Max(20, userManager.Options.Password.RequiredLength);

        while (true)
        {
            var candidate = RandomNumberGenerator.GetString(alphabet, length);
            if (await IsValidPasswordAsync(userManager, user, candidate)) return candidate;
        }
    }

    private static async Task<bool> IsValidPasswordAsync(
        UserManager<IdentityUserEntity> userManager,
        IdentityUserEntity user,
        string password)
    {
        foreach (var validator in userManager.PasswordValidators)
        {
            if (!(await validator.ValidateAsync(userManager, user, password)).Succeeded) return false;
        }

        return true;
    }
}
