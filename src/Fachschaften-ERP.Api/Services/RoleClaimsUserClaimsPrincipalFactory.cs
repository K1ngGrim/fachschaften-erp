using System.Security.Claims;
using Fachschaften_ERP.Models.Entities.Identity;
using Fachschaften_ERP.Models.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Fachschaften_ERP.Api.Services;

public class RoleClaimsUserClaimsPrincipalFactory(
    UserManager<IdentityUserEntity> userManager,
    RoleManager<IdentityRoleEntity> roleManager,
    IOptions<IdentityOptions> optionsAccessor)
    : UserClaimsPrincipalFactory<IdentityUserEntity, IdentityRoleEntity>(userManager, roleManager, optionsAccessor)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(IdentityUserEntity user)
    {
        var identity = await base.GenerateClaimsAsync(user);

        var roles = await UserManager.GetRolesAsync(user);
        foreach (var roleName in roles)
        {
            var role = await RoleManager.FindByNameAsync(roleName);
            if (role is null) continue;

            var roleClaims = await RoleManager.GetClaimsAsync(role);
            foreach (var claim in roleClaims)
            {
                if (!identity.HasClaim(claim.Type, claim.Value))
                    identity.AddClaim(claim);
            }
        }

        return identity;
    }
}