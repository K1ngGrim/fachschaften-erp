using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
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
    public async Task<ActionResult<LoginResult>> Login(LoginRequest request)
    {
        var result = await signInManager.PasswordSignInAsync(
            request.Email, request.Password, request.RememberMe, lockoutOnFailure: true);

        if (result.IsLockedOut) return StatusCode(429, "Account is locked out.");
        if (result.RequiresTwoFactor) return Ok(new LoginResult(RequiresTwoFactor: true));
        if (!result.Succeeded) return Unauthorized("Invalid credentials.");

        var user = await userManager.FindByNameAsync(request.Email);
        return Ok(new LoginResult(RequiresTwoFactor: false, Id: user!.Id, UserName: user.UserName, Email: user.Email));
    }

    [HttpPost("login/2fa")]
    public async Task<ActionResult<LoginResult>> LoginWith2Fa(Login2FaRequest request)
    {
        var result = await signInManager.TwoFactorAuthenticatorSignInAsync(
            request.Code, request.RememberMe, rememberClient: false);

        if (result.IsLockedOut) return StatusCode(429, "Account is locked out.");
        if (!result.Succeeded) return Unauthorized("Invalid code.");

        var user = await signInManager.GetTwoFactorAuthenticationUserAsync();
        return Ok(new LoginResult(RequiresTwoFactor: false, Id: user!.Id, UserName: user!.UserName, Email: user.Email));
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
            UserName = request.Email,
            Email = request.Email,
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        await signInManager.SignInAsync(user, isPersistent: false);
        return Ok(new { user.Id, user.UserName, user.Email });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var roles = await coreContext.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(coreContext.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name!)
            .ToArrayAsync();

        var claims = await coreContext.UserClaims
            .Where(uc => uc.UserId == user.Id && uc.ClaimType == "custom")
            .Select(uc => uc.ClaimValue!)
            .ToArrayAsync();

        var permissions = await coreContext.RoleClaims
            .Where(rc => rc.ClaimType == "permission" &&
                         coreContext.Roles.Any(r => roles.AsEnumerable().Contains(r.Name!) && r.Id == rc.RoleId))
            .Select(rc => rc.ClaimValue!)
            .Distinct()
            .ToArrayAsync();

        return Ok(new MeDto(user.Id, user.UserName ?? string.Empty, user.Email ?? string.Empty, roles, permissions, claims));
    }
}

public record LoginRequest(string Email, string Password, bool RememberMe = false);
public record Login2FaRequest(string Code, bool RememberMe = false);
public record LoginResult(bool RequiresTwoFactor, Guid? Id = null, string? UserName = null, string? Email = null);
public record MeDto(Guid Id, string UserName, string Email, string[] Roles, string[] Permissions, string[] Claims);
public record RegisterRequest(string Name, string? Email, string Password);