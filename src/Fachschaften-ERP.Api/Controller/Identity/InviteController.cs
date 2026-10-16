using System.Security.Claims;
using System.Text;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Email;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("api/invites")]
public class InviteController(
    UserManager<IdentityUserEntity> userManager,
    AccountMails accountMails,
    SignInManager<IdentityUserEntity> signInManager,
    CoreContext core) : ControllerBase
{
    private static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    [RequirePermission(PermissionType.UsersWrite)]
    [HttpPost]
    public async Task<ActionResult<UserDto>> Invite(InviteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required to send the invite.");

        var email = request.Email.Trim();

        // Benutzername ist die E-Mail-Adresse; sie muss deshalb eindeutig sein.
        if (await userManager.FindByUserNameOrEmailAsync(email) is not null)
            return Conflict("A user with this email already exists.");

        // Rollen vergeben darf nur, wer auch Rechte vergeben darf.
        if (request.RoleIds is { Count: > 0 } &&
            !User.HasClaim("permission", PermissionType.PermissionsWrite.GetDescription()))
            return Forbid();

        var user = new IdentityUserEntity
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim(),
            LockoutEnabled = true,
            LockoutEnd = DateTimeOffset.MaxValue,
        };

        var result = await userManager.CreateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        if (request.RoleIds is { Count: > 0 })
        {
            var roles = await core.Roles
                .Where(r => request.RoleIds.Contains(r.Id))
                .Select(r => r.Name!)
                .ToListAsync();

            await userManager.AddToRolesAsync(user, roles);
        }

        var invite = new InviteEntity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Require2Fa = request.Require2Fa,
            ExpiresAt = DateTimeOffset.UtcNow.Add(InviteLifetime),
            Accepted = false,
        };
        core.Invites.Add(invite);
        await core.SaveChangesAsync();

        if (!await TrySendInviteAsync(user, invite))
        {
            // Ohne Mail ist die Einladung wertlos; aufräumen, damit sie erneut verschickt werden kann.
            core.Invites.Remove(invite);
            await core.SaveChangesAsync();
            await userManager.DeleteAsync(user);
            return StatusCode(StatusCodes.Status502BadGateway, "The invite email could not be sent.");
        }

        return CreatedAtAction("Get", "Users", new { id = user.Id }, null);
    }

    /// <summary>
    /// Schickt eine offene oder abgelaufene Einladung erneut, mit neuem Link und neuer Frist.
    /// Frühere Links werden dabei ungültig.
    /// </summary>
    [RequirePermission(PermissionType.UsersWrite)]
    [HttpPost("{userId:guid}/resend")]
    public async Task<IActionResult> Resend(Guid userId)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();
        if (string.IsNullOrEmpty(user.Email)) return BadRequest("The user has no email address.");

        var invite = await core.Invites
            .Where(i => i.UserId == userId && !i.Accepted)
            .OrderByDescending(i => i.ExpiresAt)
            .FirstOrDefaultAsync();
        if (invite is null) return Conflict("The user has already accepted the invite.");

        // Der Token enthält den Security-Stamp; ein neuer Stamp macht alte Links ungültig.
        await userManager.UpdateSecurityStampAsync(user);
        invite.ExpiresAt = DateTimeOffset.UtcNow.Add(InviteLifetime);
        await core.SaveChangesAsync();

        return await TrySendInviteAsync(user, invite)
            ? NoContent()
            : StatusCode(StatusCodes.Status502BadGateway, "The invite email could not be sent.");
    }

    private async Task<bool> TrySendInviteAsync(IdentityUserEntity user, InviteEntity invite)
    {
        var token = await userManager.GenerateUserTokenAsync(user, "InviteTokenProvider", "Invite");
        try
        {
            await accountMails.SendInviteAsync(user, invite.Id, token, invite.Require2Fa, HttpContext.RequestAborted);
            return true;
        }
        catch (EmailSendException)
        {
            return false;
        }
    }

    [AllowAnonymous]
    [HttpPost("accept")]
    public async Task<ActionResult<AcceptInviteResult>> Accept(AcceptInviteRequest request)
    {
        var invite = await core.Invites.FirstOrDefaultAsync(i => i.Id == request.InviteId);

        if (invite is null || invite.Accepted) return BadRequest("Invalid or already accepted invite.");
        if (invite.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest("Invite has expired.");

        var user = await userManager.FindByIdAsync(invite.UserId.ToString());
        if (user is null) return NotFound();

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            return BadRequest("Invalid or expired invite token.");
        }

        var tokenValid = await userManager.VerifyUserTokenAsync(
            user,
            "InviteTokenProvider",
            "Invite",
            decodedToken
        );

        if (!tokenValid) return BadRequest("Invalid or expired invite token.");

        var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, resetToken, request.Password);

        if (!result.Succeeded) return BadRequest(result.Errors);

        await userManager.SetLockoutEndDateAsync(user, null);

        invite.Accepted = true;
        await core.SaveChangesAsync();

        await signInManager.SignInAsync(user, isPersistent: false);

        if (invite.Require2Fa)
        {
            await userManager.AddClaimAsync(user, new Claim("custom", "2fa-setup-required"));
        }

        return Ok(new AcceptInviteResult(invite.Require2Fa));
    }


}

public record AcceptInviteRequest(Guid InviteId, string Token, string Password);
public record AcceptInviteResult(bool Require2Fa);
public record InviteRequest(string? DisplayName, string? Email, IList<Guid>? RoleIds, bool Require2Fa);