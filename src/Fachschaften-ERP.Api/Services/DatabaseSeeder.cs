using System.Security.Claims;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Identity;

namespace Fachschaften_ERP.Api.Services;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRoleEntity>>();
        var userManager = services.GetRequiredService<UserManager<IdentityUserEntity>>();
        var config = services.GetRequiredService<IConfiguration>();

        await SeedRolesAsync(roleManager);
        await SeedAdminUserAsync(userManager, roleManager, config);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRoleEntity> roleManager)
    {
        var roles = new Dictionary<string, string[]>
        {
            ["Admin"] = Permissions.All.ToArray(),
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

    private static async Task SeedAdminUserAsync(
        UserManager<IdentityUserEntity> userManager,
        RoleManager<IdentityRoleEntity> roleManager,
        IConfiguration config)
    {
        var adminUserName = config["Seed:AdminUserName"] ?? "admin";
        var adminPassword = config["Seed:AdminPassword"] ?? "admin";

        if (await userManager.FindByNameAsync(adminUserName) is not null) return;

        var admin = new IdentityUserEntity { UserName = adminUserName };
        await userManager.CreateAsync(admin, adminPassword);
        await userManager.AddToRoleAsync(admin, "Admin");
    }
}