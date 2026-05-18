using System.Security.Claims;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Interfaces;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("/api/users")]
[Authorize]
public class UsersController(
    UserManager<IdentityUserEntity> userManager,
    RoleManager<IdentityRoleEntity> roleManager,
    CoreContext coreContext,
    IEmailSender emailSender,
    IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<UserDto>>> GetAll()
    {
        var users = await coreContext.Users
            .Join(coreContext.UserRoles, u => u.Id, ur => ur.UserId, (u, ur) => new { User = u, UserRole = ur })
            .Join(coreContext.Roles, ur => ur.UserRole.RoleId, r => r.Id, (ur, r) => new { ur.User, Role = r })
            .Select(x => new UserDto(
                x.User.Id,
                x.User.UserName,
                x.User.Email,
                new List<string> { x.Role.Name! }
                ))
            .ToListAsync();
        
        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var roles = await userManager.GetRolesAsync(user);
        return Ok(new { user.Id, user.UserName, user.Email, Roles = roles });
    }

    [HttpPost("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpsertUserRequest request)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        user.UserName = request.UserName ?? user.UserName;
        user.Email = request.Email ?? user.Email;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new { user.Id, user.UserName, user.Email });
    }

    [HttpPost("{id:guid}/change-password")]
    public async Task<IActionResult> ChangePassword(Guid id, ChangePasswordRequest request)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpGet("{id:guid}/roles")]
    public async Task<IActionResult> GetRoles(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        return Ok(await userManager.GetRolesAsync(user));
    }

    [HttpPost("{id:guid}/roles/{roleId:guid}")]
    public async Task<IActionResult> AddRole(Guid id, Guid roleId)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var role = await roleManager.Roles.Where(x => x.Id == roleId)
            .SingleOrDefaultAsync();

        if (role is null)
            return BadRequest($"Role '{roleId}' does not exist.");


        var result = await userManager.AddToRoleAsync(user, role?.Name);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpDelete("{id:guid}/roles/{role}")]
    public async Task<IActionResult> RemoveRole(Guid id, string role)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var result = await userManager.RemoveFromRoleAsync(user, role);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.PermissionsRead)]
    [HttpGet("{id:guid}/permissions")]
    public async Task<IActionResult> GetPermissions(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var claims = await userManager.GetClaimsAsync(user);
        return Ok(claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value));
    }

    [RequirePermission(PermissionType.PermissionsWrite)]
    [HttpPost("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> AddPermission(Guid id, string permission)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var claims = await userManager.GetClaimsAsync(user);
        if (claims.Any(c => c.Type == "permission" && c.Value == permission))
            return Conflict("Permission already assigned.");

        var result = await userManager.AddClaimAsync(user, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.PermissionsWrite)]
    [HttpDelete("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> RemovePermission(Guid id, string permission)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var result = await userManager.RemoveClaimAsync(user, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }
}

/*{
"userName": "admin",
"email": "fl*****i@gmail.com",
"password": "string!1234"
}*/

public record UserDto(Guid Id, string? UserName, string? Email, IList<string> Roles);
public record UpsertUserRequest(string? UserName, string? Email, IList<string> Roles, IList<string> Permissions);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);