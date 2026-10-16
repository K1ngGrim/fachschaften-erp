using System.Text.RegularExpressions;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Email;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/settings")]
public partial class SettingsController(CoreContext db, OrganizationSettingsService settings, MailLogo mailLogo)
    : ControllerBase
{
    /// <summary>Etwa 256 KB Bilddaten als Base64.</summary>
    private const int MaxLogoLength = 350_000;

    /// <summary>Öffentlich, weil schon die Anmeldeseite Name, Logo und Farbe braucht.</summary>
    [AllowAnonymous]
    [HttpGet("organization")]
    public async Task<ActionResult<OrganizationSettingsDto>> GetOrganization() =>
        Ok(ToDto(await settings.GetAsync(HttpContext.RequestAborted)));

    /// <summary>
    /// Logo als Bilddatei (PNG/JPEG; SVG und WebP umgewandelt) für E-Mails, die keine data:-Bilder anzeigen.
    /// Öffentlich, weil Mail-Programme es ohne Anmeldung laden.
    /// </summary>
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    [HttpGet("organization/logo")]
    public async Task<IActionResult> GetLogo(CancellationToken ct)
    {
        var logo = await mailLogo.GetAsync((await settings.GetAsync(ct)).LogoDataUrl, ct);
        if (logo is null) return NotFound();
        // Die Mail hängt ?v=<Fingerabdruck> an; ändert sich das Logo, ändert sich die URL.
        Response.Headers.CacheControl = "public, max-age=604800";
        return File(logo.Value.Data, logo.Value.ContentType);
    }

    [RequirePermission(PermissionType.SettingsWrite)]
    [HttpPut("organization")]
    public async Task<ActionResult<OrganizationSettingsDto>> UpdateOrganization(OrganizationSettingsDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100)
            return BadRequest("Name is required (max. 100 characters).");
        if (request.Subtitle?.Trim().Length > 100) return BadRequest("Subtitle is too long.");
        if (!HexColor().IsMatch(request.AccentColor ?? string.Empty))
            return BadRequest("Accent color must be a hex color like #e8912a.");
        if (request.LogoDataUrl is not null &&
            (request.LogoDataUrl.Length > MaxLogoLength || !LogoDataUrl().IsMatch(request.LogoDataUrl)))
            return BadRequest("Logo must be a PNG, JPEG, WebP or SVG image up to 256 KB.");
        if (request.PrivacyContact?.Trim().Length > 2000) return BadRequest("Privacy contact is too long.");
        if (!string.IsNullOrWhiteSpace(request.ImprintUrl) &&
            (!Uri.TryCreate(request.ImprintUrl.Trim(), UriKind.Absolute, out var uri) ||
             uri.Scheme is not ("http" or "https")))
            return BadRequest("Imprint URL must start with http:// or https://.");

        var entity = await db.OrganizationSettings.FirstOrDefaultAsync(s => s.Id == OrganizationSettingsEntity.SingletonId);
        if (entity is null)
        {
            entity = new OrganizationSettingsEntity();
            db.OrganizationSettings.Add(entity);
        }

        entity.Name = request.Name.Trim();
        entity.Subtitle = Clean(request.Subtitle);
        entity.AccentColor = request.AccentColor!.ToLowerInvariant();
        entity.LogoDataUrl = request.LogoDataUrl;
        entity.PrivacyContact = Clean(request.PrivacyContact);
        entity.ImprintUrl = Clean(request.ImprintUrl);
        entity.ModifierId = ((Invoker)User).UserId;
        entity.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Ok(ToDto(entity));
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static OrganizationSettingsDto ToDto(OrganizationSettingsEntity s) =>
        new(s.Name, s.Subtitle, s.AccentColor, s.LogoDataUrl, s.PrivacyContact, s.ImprintUrl);

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();

    [GeneratedRegex(@"^data:image/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$")]
    private static partial Regex LogoDataUrl();
}

public record OrganizationSettingsDto(
    string Name,
    string? Subtitle,
    string? AccentColor,
    string? LogoDataUrl,
    string? PrivacyContact,
    string? ImprintUrl);
