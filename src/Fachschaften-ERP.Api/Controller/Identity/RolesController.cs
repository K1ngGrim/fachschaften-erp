using System.Security.Claims;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("/api/roles")]
[Authorize]
public class RolesController(RoleManager<IdentityRoleEntity> roleManager, CoreContext core) : ControllerBase
{
    [RequirePermission(PermissionType.RolesRead)]
    [HttpGet]
    public async Task<ActionResult<IList<RoleDto>>> GetAll()
    {
        return await core.Roles
            .OrderBy(x => x.Name)
            .Select(x => new RoleDto(
                x.Id,
                x.Name!,
                x.Name == DatabaseSeeder.AdminRoleName,
                core.UserRoles.Count(ur => ur.RoleId == x.Id)))
            .ToListAsync();
    }

    [RequirePermission(PermissionType.RolesRead)]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        return role is null ? NotFound() : Ok(new { role.Id, role.Name });
    }

    [RequirePermission(PermissionType.RolesWrite)]
    [HttpPost]
    public async Task<ActionResult<RoleDto>> Create(CreateRoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Role name is required.");

        var role = new IdentityRoleEntity { Name = request.Name.Trim() };
        var result = await roleManager.CreateAsync(role);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new RoleDto(role.Id, role.Name, false, 0));
    }

    [RequirePermission(PermissionType.RolesWrite)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();
        if (IsProtected(role)) return Conflict("The Admin role cannot be deleted.");

        var result = await roleManager.DeleteAsync(role);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.RolesRead)]
    [HttpGet("{id:guid}/permissions")]
    public async Task<ActionResult<IList<string>>> GetPermissions(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var claims = await roleManager.GetClaimsAsync(role);
        return Ok(claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList());
    }

    [RequirePermission(PermissionType.RolesWrite)]
    [RequirePermission(PermissionType.PermissionsWrite)]
    [HttpPost("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> AddPermission(Guid id, string permission)
    {
        if (!Permissions.All.Contains(permission)) return BadRequest($"Unknown permission '{permission}'.");

        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var claims = await roleManager.GetClaimsAsync(role);
        if (claims.Any(c => c.Type == "permission" && c.Value == permission))
            return Conflict("Permission already assigned.");

        var result = await roleManager.AddClaimAsync(role, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.RolesWrite)]
    [RequirePermission(PermissionType.PermissionsWrite)]
    [HttpDelete("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> RemovePermission(Guid id, string permission)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();
        if (IsProtected(role)) return Conflict("Permissions of the Admin role cannot be removed.");

        var result = await roleManager.RemoveClaimAsync(role, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    private static bool IsProtected(IdentityRoleEntity role) => role.Name == DatabaseSeeder.AdminRoleName;
}

[ApiController]
[Route("api/permissions")]
[Authorize]
public class PermissionsController : ControllerBase
{

    [RequirePermission(PermissionType.PermissionsRead)]
    [HttpGet]
    public async Task<ActionResult<IList<PermissionType>>> GetAll()
    {
        return Ok(Enum.GetValues<PermissionType>());
    }
}

/// <param name="IsProtected">Admin-Rolle: nicht löschbar, Rechte nicht entziehbar.</param>
public record RoleDto(Guid Id, string Name, bool IsProtected, int UserCount);
public record CreateRoleRequest(string Name);