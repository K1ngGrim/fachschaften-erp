using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Fachschaften_ERP.Models.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("/api/auth")]
public class AuthController(
    SignInManager<IdentityUserEntity> signInManager,
    UserManager<IdentityUserEntity> userManager,
    RoleManager<IdentityRoleEntity> roleManager,
    CoreContext coreContext
    ) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await signInManager.PasswordSignInAsync(
            request.UserName, request.Password, request.RememberMe, lockoutOnFailure: true);

        if (result.IsLockedOut) return StatusCode(429, "Account is locked out.");
        if (!result.Succeeded) return Unauthorized("Invalid credentials.");

        var user = await userManager.FindByNameAsync(request.UserName);
        return Ok(new { user!.Id, user.UserName, user.Email });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new IdentityUserEntity
        {
            UserName = request.UserName,
            Email = request.Email,
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        await signInManager.SignInAsync(user, isPersistent: false);
        return Ok(new { user.Id, user.UserName, user.Email });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var roles = await coreContext.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(coreContext.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name!)
            .ToArrayAsync();

        var permissions = await coreContext.RoleClaims
            .Where(rc => rc.ClaimType == "permission" &&
                         coreContext.Roles.Any(r => roles.AsEnumerable().Contains(r.Name!) && r.Id == rc.RoleId))
            .Select(rc => rc.ClaimValue!)
            .Distinct()
            .ToArrayAsync();

        return Ok(new MeDto(user.Id, user.UserName ?? string.Empty, user.Email ?? string.Empty, roles, permissions));
    }
}

public record MeDto(Guid Id, string UserName, string Email, string[] Roles, string[] Permissions);
public record LoginRequest(string UserName, string Password, bool RememberMe = false);
public record RegisterRequest(string UserName, string? Email, string Password);