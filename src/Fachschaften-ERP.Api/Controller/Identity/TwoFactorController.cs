using System.Security.Claims;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QRCoder;

namespace Fachschaften_ERP.Api.Controller.Identity;

[ApiController]
[Route("api/auth/2fa")]
[Authorize]
public class TwoFactorController(
    SignInManager<IdentityUserEntity> signInManager,
    UserManager<IdentityUserEntity> userManager,
    CoreContext coreContext

    ) : ControllerBase
{
    [HttpGet("setup")]
    public async Task<ActionResult<Setup2FaResult>> GetSetup()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        // Den Schlüssel einer aktiven 2FA nicht herausgeben; neu einrichten läuft über POST reset.
        if (await userManager.GetTwoFactorEnabledAsync(user)) return Conflict("2FA is already enabled.");

        var key = await userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            key = await userManager.GetAuthenticatorKeyAsync(user);
        }

        var appName = "Fachschaften ERP";
        var email = user.Email ?? user.UserName ?? "user";
        var otpUri = $"otpauth://totp/{Uri.EscapeDataString(appName)}:{Uri.EscapeDataString(email)}?secret={key}&issuer={Uri.EscapeDataString(appName)}&digits=6";

        var qrCode = GenerateQrCode(otpUri);

        return Ok(new Setup2FaResult(qrCode, key!));
    }

    [HttpPost("setup")]
    public async Task<ActionResult> ConfirmSetup(Setup2FaRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var isValid = await userManager.VerifyTwoFactorTokenAsync(
            user,
            userManager.Options.Tokens.AuthenticatorTokenProvider,
            request.Code);

        if (!isValid) return BadRequest("Invalid code.");

        await userManager.SetTwoFactorEnabledAsync(user, true);

        await coreContext.UserClaims
            .Where(uc => uc.UserId == user.Id && uc.ClaimType == "custom" && uc.ClaimValue == "2fa-setup-required")
            .ExecuteDeleteAsync();

        await coreContext.SaveChangesAsync();
        await signInManager.SignOutAsync();

        return NoContent();
    }

    /// <summary>
    /// Erzeugt einen neuen Authenticator-Schlüssel. 2FA ist danach aus, bis die Einrichtung
    /// über <c>POST setup</c> bestätigt wurde; der Claim erzwingt diese Einrichtung im Frontend.
    /// </summary>
    [HttpPost("reset")]
    public async Task<ActionResult> Reset(Reset2FaRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        if (!await userManager.CheckPasswordAsync(user, request.Password))
            return BadRequest("Invalid password.");

        await userManager.SetTwoFactorEnabledAsync(user, false);
        await userManager.ResetAuthenticatorKeyAsync(user);

        var setupRequired = new Claim("custom", "2fa-setup-required");
        var claims = await userManager.GetClaimsAsync(user);
        if (!claims.Any(c => c.Type == setupRequired.Type && c.Value == setupRequired.Value))
            await userManager.AddClaimAsync(user, setupRequired);

        await signInManager.RefreshSignInAsync(user);
        return NoContent();
    }

    [HttpPost("disable")]
    public async Task<ActionResult> Disable(Disable2FaRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        if (!await userManager.CheckPasswordAsync(user, request.Password))
            return BadRequest("Invalid password.");

        await userManager.SetTwoFactorEnabledAsync(user, false);
        await userManager.ResetAuthenticatorKeyAsync(user);

        // Neuer Security-Stamp: Cookie neu ausstellen, sonst endet die Sitzung beim nächsten Check.
        await signInManager.RefreshSignInAsync(user);
        return NoContent();
    }

    private static string GenerateQrCode(string content)
    {
        using var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var bytes = qrCode.GetGraphic(10);
        return $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
    }
}

public record Setup2FaResult(string QrCode, string Secret);
public record Setup2FaRequest(string Code);
public record Reset2FaRequest(string Password);
public record Disable2FaRequest(string Password);