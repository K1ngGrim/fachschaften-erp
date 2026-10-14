using System.Security.Claims;
using System.Text.Json.Serialization;
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
[Route("/api/users")]
[Authorize]
public class UsersController(
    UserManager<IdentityUserEntity> userManager,
    SignInManager<IdentityUserEntity> signInManager,
    CoreContext coreContext) : ControllerBase
{
    [RequirePermission(PermissionType.UsersRead)]
    [HttpGet]
    public async Task<ActionResult<IList<UserDto>>> GetAll()
    {
        var users = await coreContext.Users.ToListAsync();
        var dtos = await ToDtosAsync(users);
        return Ok(dtos.OrderBy(x => x.DisplayName, StringComparer.CurrentCultureIgnoreCase).ToList());
    }

    [RequirePermission(PermissionType.UsersRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> Get(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        return Ok((await ToDtosAsync([user])).Single());
    }

    /// <summary>
    /// Ändert Anzeigename, E-Mail und Rollen. Rollen ändern erfordert zusätzlich
    /// permissions.canwrite; die letzte Admin-Zuordnung bleibt immer erhalten.
    /// </summary>
    [RequirePermission(PermissionType.UsersWrite)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserDto>> Update(Guid id, UpdateUserRequest request)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        if (email is not null && await EmailTakenAsync(email, user.Id))
            return Conflict("Email already in use.");

        user.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            result = await userManager.SetEmailAsync(user, email);
            if (!result.Succeeded) return BadRequest(result.Errors);
        }

        if (request.RoleIds is not null)
        {
            var roleResult = await SetRolesAsync(user, request.RoleIds);
            if (roleResult is not null) return roleResult;
        }

        // Eine neue E-Mail erneuert den Security-Stamp; die eigene Sitzung sonst beendet.
        if (userManager.GetUserId(User) == user.Id.ToString())
            await signInManager.RefreshSignInAsync(user);

        return Ok((await ToDtosAsync([user])).Single());
    }

    [HttpPost("{id:guid}/change-password")]
    public async Task<IActionResult> ChangePassword(Guid id, ChangePasswordRequest request)
    {
        // Nur das eigene Passwort; fremde Konten laufen über Einladung/Reset.
        if (userManager.GetUserId(User) != id.ToString()) return Forbid();

        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (request.CurrentPassword == request.NewPassword)
            return BadRequest(new[] { new IdentityError { Code = "PasswordUnchanged", Description = "The new password must differ from the current one." } });

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded) return BadRequest(result.Errors);

        var changeRequired = new Claim("custom", DatabaseSeeder.PasswordChangeRequiredClaim);
        if ((await userManager.GetClaimsAsync(user)).Any(c => c.Type == changeRequired.Type && c.Value == changeRequired.Value))
            await userManager.RemoveClaimAsync(user, changeRequired);

        // Neuer Security-Stamp: Cookie neu ausstellen, sonst wird die eigene Sitzung beim nächsten Check beendet.
        await signInManager.RefreshSignInAsync(user);
        return NoContent();
    }

    [RequirePermission(PermissionType.UsersWrite)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (userManager.GetUserId(User) == id.ToString())
            return Conflict("You cannot delete your own account.");

        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (await IsLastAdminAsync(user))
            return Conflict("The last admin cannot be deleted.");

        // Einladungen hängen ohne Fremdschlüssel am Benutzer und werden mit entfernt.
        await coreContext.Invites.Where(i => i.UserId == user.Id).ExecuteDeleteAsync();
        // Tresor samt Freigaben für vertrauliche Tabellen (Freigaben hängen per Cascade daran).
        await coreContext.Vaults.Where(v => v.UserId == user.Id).ExecuteDeleteAsync();

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.UsersRead)]
    [RequirePermission(PermissionType.PermissionsRead)]
    [HttpGet("{id:guid}/permissions")]
    public async Task<ActionResult<IList<string>>> GetPermissions(Guid id)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var claims = await userManager.GetClaimsAsync(user);
        return Ok(claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList());
    }

    [RequirePermission(PermissionType.UsersWrite)]
    [RequirePermission(PermissionType.PermissionsWrite)]
    [HttpPost("{id:guid}/permissions/{permission}")]
    public async Task<IActionResult> AddPermission(Guid id, string permission)
    {
        if (!Permissions.All.Contains(permission)) return BadRequest($"Unknown permission '{permission}'.");

        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var claims = await userManager.GetClaimsAsync(user);
        if (claims.Any(c => c.Type == "permission" && c.Value == permission))
            return Conflict("Permission already assigned.");

        var result = await userManager.AddClaimAsync(user, new Claim("permission", permission));
        if (!result.Succeeded) return BadRequest(result.Errors);

        return NoContent();
    }

    [RequirePermission(PermissionType.UsersWrite)]
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

    /// <returns>null bei Erfolg, sonst die Fehlerantwort.</returns>
    private async Task<ActionResult?> SetRolesAsync(IdentityUserEntity user, IList<Guid> roleIds)
    {
        var target = await coreContext.Roles
            .Where(r => roleIds.Contains(r.Id))
            .Select(r => r.Name!)
            .ToListAsync();
        if (target.Count != roleIds.Distinct().Count()) return BadRequest("One or more roles do not exist.");

        var current = await userManager.GetRolesAsync(user);
        var toAdd = target.Except(current).ToList();
        var toRemove = current.Except(target).ToList();
        if (toAdd.Count == 0 && toRemove.Count == 0) return null;

        // Rollen vergeben darf nur, wer auch Rechte vergeben darf.
        if (!User.HasClaim("permission", PermissionType.PermissionsWrite.GetDescription()))
            return Forbid();

        if (toRemove.Contains(DatabaseSeeder.AdminRoleName) && await IsLastAdminAsync(user))
            return Conflict("The last admin cannot lose the Admin role.");

        var result = await userManager.RemoveFromRolesAsync(user, toRemove);
        if (result.Succeeded) result = await userManager.AddToRolesAsync(user, toAdd);
        return result.Succeeded ? null : BadRequest(result.Errors);
    }

    private async Task<bool> IsLastAdminAsync(IdentityUserEntity user)
    {
        var admins = await userManager.GetUsersInRoleAsync(DatabaseSeeder.AdminRoleName);
        return admins.Count == 1 && admins[0].Id == user.Id;
    }

    private Task<bool> EmailTakenAsync(string email, Guid exceptUserId)
    {
        var normalized = userManager.NormalizeEmail(email);
        return coreContext.Users.AnyAsync(u => u.NormalizedEmail == normalized && u.Id != exceptUserId);
    }

    private async Task<List<UserDto>> ToDtosAsync(IList<IdentityUserEntity> users)
    {
        var ids = users.Select(u => u.Id).ToList();

        var roles = await coreContext.UserRoles
            .Where(ur => ids.Contains(ur.UserId))
            .Join(coreContext.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Id, r.Name })
            .ToListAsync();

        var openInvites = await coreContext.Invites
            .Where(i => ids.Contains(i.UserId) && !i.Accepted)
            .ToListAsync();

        var now = DateTimeOffset.UtcNow;
        return users
            .Select(u =>
            {
                var invites = openInvites.Where(i => i.UserId == u.Id).ToList();
                var status = invites.Count == 0 ? UserStatus.Active
                    : invites.Any(i => i.ExpiresAt > now) ? UserStatus.InvitePending
                    : UserStatus.InviteExpired;

                return new UserDto(
                    u.Id,
                    u.UserName ?? string.Empty,
                    u.DisplayName ?? u.UserName ?? string.Empty,
                    u.Email,
                    roles.Where(r => r.UserId == u.Id)
                        .Select(r => new UserRoleDto(r.Id, r.Name!))
                        .OrderBy(r => r.Name)
                        .ToList(),
                    status,
                    u.TwoFactorEnabled);
            })
            .ToList();
    }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum UserStatus
{
    Active,
    InvitePending,
    InviteExpired,
}

public record UserRoleDto(Guid Id, string Name);

/// <param name="DisplayName">Anzeigename, sonst der Benutzername.</param>
public record UserDto(
    Guid Id,
    string UserName,
    string DisplayName,
    string? Email,
    IList<UserRoleDto> Roles,
    UserStatus Status,
    bool TwoFactorEnabled);

/// <param name="RoleIds">null lässt die Rollen unverändert.</param>
public record UpdateUserRequest(string? DisplayName, string? Email, IList<Guid>? RoleIds);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
