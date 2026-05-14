using System.Security.Claims;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("/api/roles")]
[Authorize]
public class RolesController(RoleManager<IdentityRoleEntity> roleManager) : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() =>
        Ok(roleManager.Roles.Select(r => new { r.Id, r.Name }).ToList());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        return role is null ? NotFound() : Ok(new { role.Id, role.Name });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateRoleRequest request)
    {
        var role = new IdentityRoleEntity { Name = request.Name };
        var result = await roleManager.CreateAsync(role);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new { role.Id, role.Name });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var result = await roleManager.DeleteAsync(role);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpGet("{id:guid}/permissions")]
    public async Task<IActionResult> GetPermissions(Guid id)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var claims = await roleManager.GetClaimsAsync(role);
        return Ok(claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value));
    }

    [HttpPost("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> AddPermission(Guid id, string permission)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var claims = await roleManager.GetClaimsAsync(role);
        if (claims.Any(c => c.Type == "permission" && c.Value == permission))
            return Conflict("Permission already assigned.");

        var result = await roleManager.AddClaimAsync(role, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpDelete("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> RemovePermission(Guid id, string permission)
    {
        var role = await roleManager.FindByIdAsync(id.ToString());
        if (role is null) return NotFound();

        var result = await roleManager.RemoveClaimAsync(role, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }
}

[ApiController]
[Route("api/permissions")]
[Authorize]
public class PermissionsController : ControllerBase
{

    [RequirePermission(Permissions.PermissionsRead)]
    [HttpGet]
    public async Task<ActionResult<IList<string>>> GetAll()
    {
        return Ok(Permissions.All);
    }
}

public record CreateRoleRequest(string Name);