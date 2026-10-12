using System.Net;
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
    IEmailSender emailSender,
    SignInManager<IdentityUserEntity> signInManager,
    CoreContext core,
    IConfiguration config) : ControllerBase
{
    [RequirePermission(PermissionType.UsersWrite)]
    [HttpPost]
    public async Task<IActionResult> Invite(
        InviteRequest request
        )
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required to send the invite.");

        if (await userManager.FindByNameAsync(request.UserName) is not null)
            return Conflict("Username already taken.");

        // Rollen vergeben darf nur, wer auch Rechte vergeben darf.
        if (request.Roles is { Count: > 0 } &&
            !User.HasClaim("permission", PermissionType.PermissionsWrite.GetDescription()))
            return Forbid();

        var user = new IdentityUserEntity
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email,
            LockoutEnabled = true,
            LockoutEnd = DateTimeOffset.MaxValue,
        };

        var invite = new InviteEntity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Require2Fa = request.Require2Fa,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            Accepted = false,
        };

        core.Invites.Add(invite);
        await core.SaveChangesAsync();

        var result = await userManager.CreateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        if (request.Roles is { Count: > 0 })
        {
            var roles = await core.Roles
                .Where(r => request.Roles.Contains(r.Id.ToString()))
                .Select(r => r.Name)
                .ToListAsync();

            await userManager.AddToRolesAsync(user, roles!);
        }

        var token = await userManager.GenerateUserTokenAsync(
            user,
            "InviteTokenProvider",
            "Invite"
        );
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        var baseUrl = config["App:BaseUrl"] ?? "http://localhost:4200";
        var inviteLink = $"{baseUrl}/accept-invite?inviteId={invite.Id}&token={encodedToken}";

        var name = WebUtility.HtmlEncode(request.UserName);
        var message = new EmailMessage(
            new EmailAddress(request.Email, request.UserName),
            "Du wurdest eingeladen",
            $"""
            <p>Hallo {name},</p>
            <p>Du wurdest zum Fachschaften ERP eingeladen.</p>
            <p><a href="{inviteLink}">Jetzt Account aktivieren</a></p>
            """,
            $"""
            Hallo {request.UserName},

            Du wurdest zum Fachschaften ERP eingeladen. Aktiviere deinen Account hier:
            {inviteLink}
            """
        );

        try
        {
            await emailSender.SendAsync(message, HttpContext.RequestAborted);
        }
        catch (EmailSendException)
        {
            // Ohne Mail ist die Einladung wertlos; aufräumen, damit sie erneut verschickt werden kann.
            core.Invites.Remove(invite);
            await core.SaveChangesAsync();
            await userManager.DeleteAsync(user);
            return StatusCode(StatusCodes.Status502BadGateway, "The invite email could not be sent.");
        }

        return CreatedAtAction("Get", "Users", new { id = user.Id }, new { user.Id, user.UserName, user.Email });
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
public record InviteRequest(string UserName, string? Email, IList<string>? Roles, bool Require2Fa);