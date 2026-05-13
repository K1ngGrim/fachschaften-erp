using Microsoft.AspNetCore.Authorization;

namespace Fachschaften_ERP.Api.Services;

public record PermissionRequirement(string Permission) : IAuthorizationRequirement;

public class PermissionHandler(IHttpContextAccessor httpContextAccessor)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {

        var hasClaim = context.User.Claims
            .Any(c => c.Type == "permission" && c.Value == requirement.Permission);

        if (hasClaim) context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

public class RequirePermissionAttribute(string permission)
    : AuthorizeAttribute, IAuthorizationRequirementData
{
    public IEnumerable<IAuthorizationRequirement> GetRequirements() =>
        [new PermissionRequirement(permission)];
}