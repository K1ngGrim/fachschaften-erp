using System.Text.Json;
using System.Text.RegularExpressions;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Documents;
using Fachschaften_ERP.Api.Services.Modules;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Dokumente-Modul: Typst-Vorlagen mit Versionen verwalten, ausfüllen und als PDF erzeugen.
/// Erzeugte Dokumente werden nur abgelegt, wenn die Vorlage das vorsieht; sonst bleibt nichts gespeichert.
/// Die PDF-Endpunkte stehen nicht im API-Client, das Frontend ruft sie direkt auf.
/// </summary>
[ApiController]
[Route("/api/documents")]
[RequireModule(AppModules.Documents)]
public partial class DocumentsController(
    CoreContext db,
    TypstCompiler typst,
    OrganizationSettingsService organizationSettings,
    PublicFilesCache publicFiles,
    IConfiguration configuration) : ControllerBase
{
    private const int MaxAssetBytes = 5 * 1024 * 1024;
    private const int MaxAssetsPerVersion = 30;
    private const int MaxFields = 50;
    private const int MaxSourceLength = 200_000;

    /// <summary>Dateitypen, die Typst lesen kann (Bilder inkl. PDF, Schriften, Daten, Typst-Dateien).</summary>
    internal static readonly HashSet<string> AllowedExtensions =
    [
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".ttf", ".otf", ".ttc",
        ".typ", ".csv", ".json", ".yaml", ".yml", ".toml", ".bib", ".txt", ".xml",
    ];

    private static readonly HashSet<string> ReservedNames = ["main.typ", "data.json"];

    // ── Vorlagen ────────────────────────────────────────────────────────────

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("templates")]
    public async Task<ActionResult<IList<DocumentTemplateSummaryDto>>> GetTemplates()
    {
        var templates = await db.DocumentTemplates
            .Where(t => t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id, t.Name, t.Description, t.StoreDocuments, t.CurrentVersion,
                UpdatedAt = t.Modified ?? t.Created,
                Fields = t.Versions.Where(v => v.Version == t.CurrentVersion).Select(v => v.Fields).FirstOrDefault(),
                DocumentCount = db.GeneratedDocuments.Count(d => d.TemplateId == t.Id && d.IsActive),
            })
            .ToListAsync();

        return Ok(templates.Select(t => new DocumentTemplateSummaryDto(t.Id, t.Name, t.Description, t.StoreDocuments,
            t.CurrentVersion, t.Fields?.Count ?? 0, t.DocumentCount, t.UpdatedAt)).ToList());
    }

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("templates/{id:guid}")]
    public async Task<ActionResult<DocumentTemplateDto>> GetTemplate(Guid id)
    {
        var template = await db.DocumentTemplates.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        return template is null ? NotFound() : Ok(await ToDtoAsync(template));
    }

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("templates/{id:guid}/versions")]
    public async Task<ActionResult<IList<DocumentTemplateVersionSummaryDto>>> GetVersions(Guid id)
    {
        if (!await db.DocumentTemplates.AnyAsync(t => t.Id == id && t.IsActive)) return NotFound();
        var versions = await db.DocumentTemplateVersions
            .Where(v => v.TemplateId == id)
            .OrderByDescending(v => v.Version)
            .Select(v => new { v.Version, v.Comment, v.Created, v.CreatorId })
            .ToListAsync();
        var names = await UserNamesAsync(versions.Select(v => v.CreatorId));
        return Ok(versions.Select(v => new DocumentTemplateVersionSummaryDto(v.Version, v.Comment, v.Created,
            names.GetValueOrDefault(v.CreatorId))).ToList());
    }

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("templates/{id:guid}/versions/{version:int}")]
    public async Task<ActionResult<DocumentTemplateVersionDto>> GetVersion(Guid id, int version)
    {
        if (!await db.DocumentTemplates.AnyAsync(t => t.Id == id && t.IsActive)) return NotFound();
        var entity = await db.DocumentTemplateVersions.FirstOrDefaultAsync(v => v.TemplateId == id && v.Version == version);
        return entity is null ? NotFound() : Ok(await ToVersionDtoAsync(entity));
    }

    /// <summary>Neue Vorlage (Version 1). Dateien lassen sich erst danach hochladen.</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPost("templates")]
    public async Task<ActionResult<DocumentTemplateDto>> CreateTemplate(SaveDocumentTemplateRequest request)
    {
        var (fields, error) = Validate(request);
        if (error is not null) return BadRequest(error);
        if (request.AssetIds is { Count: > 0 }) return BadRequest("Assets can only be added to an existing template.");

        var userId = ((Invoker)User).UserId;
        var now = DateTimeOffset.UtcNow;
        var template = new DocumentTemplateEntity
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = Clean(request.Description),
            StoreDocuments = request.StoreDocuments,
            CurrentVersion = 1,
            CreatorId = userId,
            Created = now,
            IsActive = true,
        };
        db.DocumentTemplates.Add(template);
        db.DocumentTemplateVersions.Add(NewVersion(template.Id, 1, request, fields!, [], userId, now));
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, await ToDtoAsync(template));
    }

    /// <summary>
    /// Speichert die Vorlage. Ändern sich Quelltext, Felder oder Dateien, entsteht eine neue Version;
    /// Name, Beschreibung und Ablage-Einstellung ändern sich ohne neue Version.
    /// </summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPut("templates/{id:guid}")]
    public async Task<ActionResult<DocumentTemplateDto>> UpdateTemplate(Guid id, SaveDocumentTemplateRequest request)
    {
        var template = await db.DocumentTemplates.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (template is null) return NotFound();

        var (fields, error) = Validate(request);
        if (error is not null) return BadRequest(error);

        var assetIds = (request.AssetIds ?? []).Distinct().ToList();
        if (assetIds.Count > MaxAssetsPerVersion) return BadRequest($"At most {MaxAssetsPerVersion} files are allowed.");
        var assets = await db.DocumentAssets.Where(a => assetIds.Contains(a.Id) && a.TemplateId == id)
            .Select(a => new { a.Id, a.FileName }).ToListAsync();
        if (assets.Count != assetIds.Count) return BadRequest("Unknown file.");
        if (assets.GroupBy(a => a.FileName, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
            return BadRequest("File names must be unique.");

        var userId = ((Invoker)User).UserId;
        var now = DateTimeOffset.UtcNow;
        var current = await db.DocumentTemplateVersions.FirstAsync(v => v.TemplateId == id && v.Version == template.CurrentVersion);
        var changed = current.Source != request.Source ||
                      JsonSerializer.Serialize(current.Fields) != JsonSerializer.Serialize(fields) ||
                      !current.AssetIds.Order().SequenceEqual(assetIds.Order());
        if (changed)
        {
            template.CurrentVersion++;
            db.DocumentTemplateVersions.Add(NewVersion(id, template.CurrentVersion, request, fields!, assetIds, userId, now));
        }

        template.Name = request.Name.Trim();
        template.Description = Clean(request.Description);
        template.StoreDocuments = request.StoreDocuments;
        template.ModifierId = userId;
        template.Modified = now;
        await db.SaveChangesAsync();
        return Ok(await ToDtoAsync(template));
    }

    /// <summary>Löscht die Vorlage (abgelegte Dokumente bleiben erhalten, bis man sie einzeln löscht).</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
    {
        var template = await db.DocumentTemplates.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (template is null) return NotFound();
        template.IsActive = false;
        template.ModifierId = ((Invoker)User).UserId;
        template.Modified = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Lädt eine Datei hoch; sie gehört erst nach dem Speichern zu einer Version.</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPost("templates/{id:guid}/assets")]
    public async Task<ActionResult<DocumentAssetDto>> UploadAsset(Guid id, UploadDocumentAssetRequest request)
    {
        if (!await db.DocumentTemplates.AnyAsync(t => t.Id == id && t.IsActive)) return NotFound();

        var fileName = Path.GetFileName(request.FileName?.Trim() ?? string.Empty);
        if (fileName.Length is 0 or > 200 || !SafeFileName().IsMatch(fileName))
            return BadRequest("Invalid file name (letters, digits, '-', '_' and '.').");
        if (ReservedNames.Contains(fileName.ToLowerInvariant())) return BadRequest($"'{fileName}' is reserved.");
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension)) return BadRequest($"Files of type '{extension}' are not allowed.");

        byte[] data;
        try
        {
            data = Convert.FromBase64String(request.ContentBase64);
        }
        catch (FormatException)
        {
            return BadRequest("Content must be Base64.");
        }
        if (data.Length is 0 or > MaxAssetBytes) return BadRequest("Files must be between 1 byte and 5 MB.");

        var asset = new DocumentAssetEntity
        {
            Id = Guid.NewGuid(),
            TemplateId = id,
            FileName = fileName,
            ContentType = ContentType(extension),
            Data = data,
            CreatorId = ((Invoker)User).UserId,
            Created = DateTimeOffset.UtcNow,
        };
        db.DocumentAssets.Add(asset);
        await db.SaveChangesAsync();
        return Ok(new DocumentAssetDto(asset.Id, asset.FileName, asset.ContentType, data.Length));
    }

    // ── PDF erzeugen ────────────────────────────────────────────────────────

    /// <summary>Vorschau beim Bearbeiten einer Vorlage (ungespeicherter Stand); speichert nichts.</summary>
    [ApiExplorerSettings(IgnoreApi = true)]
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPost("templates/{id:guid}/preview")]
    public async Task<IActionResult> PreviewDraft(Guid id, PreviewDocumentTemplateRequest request, CancellationToken ct)
    {
        if (!await db.DocumentTemplates.AnyAsync(t => t.Id == id && t.IsActive, ct)) return NotFound();
        if (request.Source.Length > MaxSourceLength) return BadRequest("Source is too long.");

        var assetIds = request.AssetIds ?? [];
        var assets = await db.DocumentAssets.Where(a => assetIds.Contains(a.Id) && a.TemplateId == id).ToListAsync(ct);
        return await CompileAsync(request.Source, request.Fields ?? [], assets, request.Values, ct);
    }

    /// <summary>
    /// Erzeugt das PDF mit der aktuellen Version. Mit <c>store=true</c> und Ablage an der Vorlage wird
    /// es abgelegt (Id im Header <c>X-Document-Id</c>); sonst bleibt nichts gespeichert.
    /// </summary>
    [ApiExplorerSettings(IgnoreApi = true)]
    [RequirePermission(PermissionType.DocumentsWrite)]
    [HttpPost("templates/{id:guid}/render")]
    public async Task<IActionResult> Render(Guid id, RenderDocumentRequest request, [FromQuery] bool store, CancellationToken ct)
    {
        var template = await db.DocumentTemplates.FirstOrDefaultAsync(t => t.Id == id && t.IsActive, ct);
        if (template is null) return NotFound();
        var version = await db.DocumentTemplateVersions.FirstAsync(v => v.TemplateId == id && v.Version == template.CurrentVersion, ct);

        // Beim Ablegen müssen die Werte vollständig sein; die Vorschau zeigt auch Zwischenstände.
        var (values, error) = CustomTablesController.NormalizeValues(version.Fields, request.Values);
        if (store && error is not null) return BadRequest(error);

        var assets = await db.DocumentAssets.Where(a => version.AssetIds.Contains(a.Id)).ToListAsync(ct);
        var result = await CompileAsync(version.Source, version.Fields, assets,
            values?.RootElement ?? request.Values, ct);
        if (!store || !template.StoreDocuments || result is not FileContentResult pdf) return result;

        var title = string.IsNullOrWhiteSpace(request.Title) ? template.Name : request.Title.Trim();
        if (title.Length > 200) return BadRequest("Title is too long.");
        var document = new GeneratedDocumentEntity
        {
            Id = Guid.NewGuid(),
            TemplateId = id,
            TemplateVersionId = version.Id,
            TemplateVersion = version.Version,
            Title = title,
            Values = values!,
            Pdf = pdf.FileContents,
            CreatorId = ((Invoker)User).UserId,
            Created = DateTimeOffset.UtcNow,
            IsActive = true,
        };
        db.GeneratedDocuments.Add(document);
        await db.SaveChangesAsync(ct);
        Response.Headers["X-Document-Id"] = document.Id.ToString();
        return pdf;
    }

    // ── Abgelegte Dokumente ─────────────────────────────────────────────────

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("templates/{id:guid}/documents")]
    public async Task<ActionResult<IList<GeneratedDocumentDto>>> GetDocuments(Guid id)
    {
        var documents = await db.GeneratedDocuments
            .Where(d => d.TemplateId == id && d.IsActive)
            .OrderByDescending(d => d.Created)
            .Select(d => new { d.Id, d.Title, d.TemplateVersion, d.Created, d.CreatorId, Size = d.Pdf.Length })
            .ToListAsync();
        var names = await UserNamesAsync(documents.Select(d => d.CreatorId));
        return Ok(documents.Select(d => new GeneratedDocumentDto(d.Id, d.Title, d.TemplateVersion, d.Created,
            names.GetValueOrDefault(d.CreatorId), d.Size)).ToList());
    }

    /// <summary>Werte eines abgelegten Dokuments, z. B. um es als Vorlage für ein neues zu nehmen.</summary>
    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("documents/{documentId:guid}/values")]
    public async Task<ActionResult<JsonElement>> GetDocumentValues(Guid documentId)
    {
        var document = await db.GeneratedDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.IsActive);
        return document is null ? NotFound() : Ok(document.Values.RootElement.Clone());
    }

    [ApiExplorerSettings(IgnoreApi = true)]
    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("documents/{documentId:guid}/pdf")]
    public async Task<IActionResult> GetDocumentPdf(Guid documentId)
    {
        var document = await db.GeneratedDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.IsActive);
        return document is null ? NotFound() : File(document.Pdf, "application/pdf", FileName(document.Title));
    }

    [RequirePermission(PermissionType.DocumentsWrite)]
    [HttpDelete("documents/{documentId:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid documentId)
    {
        var document = await db.GeneratedDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.IsActive);
        if (document is null) return NotFound();
        // Ganz entfernen statt nur ausblenden: abgelegte Dokumente können personenbezogen sein.
        db.GeneratedDocuments.Remove(document);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Hilfen ──────────────────────────────────────────────────────────────

    private async Task<IActionResult> CompileAsync(
        string source,
        IList<CustomTableColumn> fields,
        IList<DocumentAssetEntity> assets,
        JsonElement values,
        CancellationToken ct)
    {
        var organization = (await organizationSettings.GetAsync(ct)).Name;
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, AppTimeZone.From(configuration));
        var variables = await db.DocumentVariables.AsNoTracking()
            .ToDictionaryAsync(v => v.Key, v => v.Value, ct);
        var data = DocumentData.Build(fields, values, organization, localNow, variables);
        try
        {
            var publicDirectory = await publicFiles.GetDirectoryAsync(db, ct);
            var pdf = await typst.CompileAsync(
                source, assets.Select(a => (a.FileName, a.Data)), data, publicDirectory, ct);
            return File(pdf, "application/pdf");
        }
        catch (TypstException e)
        {
            return UnprocessableEntity(new TypstErrorDto(e.Message));
        }
    }

    /// <summary>Prüft Name, Quelltext und Felder; die Feld-Id ist der Schlüssel in data.json.</summary>
    private static (List<CustomTableColumn>? Fields, string? Error) Validate(SaveDocumentTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return (null, "Name is required.");
        if (request.Name.Trim().Length > 100) return (null, "Name is too long.");
        if (request.Description?.Trim().Length > 500) return (null, "Description is too long.");
        if (request.Comment?.Trim().Length > 500) return (null, "Comment is too long.");
        if (string.IsNullOrWhiteSpace(request.Source)) return (null, "Source is required.");
        if (request.Source.Length > MaxSourceLength) return (null, "Source is too long.");

        var fields = new List<CustomTableColumn>();
        foreach (var field in request.Fields ?? [])
        {
            var key = field.Id?.Trim() ?? string.Empty;
            if (!FieldKey().IsMatch(key)) return (null, $"Field key '{key}' must start with a letter and contain only a-z, 0-9 and '_'.");
            if (fields.Any(f => f.Id == key)) return (null, $"Field key '{key}' is used twice.");
            if (string.IsNullOrWhiteSpace(field.Label) || field.Label.Trim().Length > 100) return (null, "Every field needs a label.");
            if (!Enum.IsDefined(field.Type)) return (null, "Unknown field type.");

            IList<string>? options = null;
            if (field.Type == CustomTableColumnType.Select)
            {
                options = (field.Options ?? []).Select(o => o.Trim()).Where(o => o.Length > 0).Distinct().ToList();
                if (options.Count is 0 or > 100) return (null, $"Field '{field.Label}' needs 1 to 100 options.");
            }
            fields.Add(new CustomTableColumn(key, field.Label.Trim(), field.Type, field.Required, options));
        }
        if (fields.Count > MaxFields) return (null, $"At most {MaxFields} fields are allowed.");
        return (fields, null);
    }

    private static DocumentTemplateVersionEntity NewVersion(
        Guid templateId, int version, SaveDocumentTemplateRequest request, List<CustomTableColumn> fields,
        List<Guid> assetIds, Guid userId, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        TemplateId = templateId,
        Version = version,
        Source = request.Source,
        Fields = fields,
        AssetIds = assetIds,
        Comment = Clean(request.Comment),
        CreatorId = userId,
        Created = now,
    };

    private async Task<DocumentTemplateDto> ToDtoAsync(DocumentTemplateEntity template)
    {
        var version = await db.DocumentTemplateVersions
            .FirstAsync(v => v.TemplateId == template.Id && v.Version == template.CurrentVersion);
        return new DocumentTemplateDto(template.Id, template.Name, template.Description, template.StoreDocuments,
            template.CurrentVersion, await ToVersionDtoAsync(version));
    }

    private async Task<DocumentTemplateVersionDto> ToVersionDtoAsync(DocumentTemplateVersionEntity version)
    {
        var assets = await db.DocumentAssets
            .Where(a => version.AssetIds.Contains(a.Id))
            .OrderBy(a => a.FileName)
            .Select(a => new DocumentAssetDto(a.Id, a.FileName, a.ContentType, a.Data.Length))
            .ToListAsync();
        var names = await UserNamesAsync([version.CreatorId]);
        return new DocumentTemplateVersionDto(version.Version, version.Source, version.Fields, assets, version.Comment,
            version.Created, names.GetValueOrDefault(version.CreatorId));
    }

    private async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return await db.Users.Where(u => distinct.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.UserName ?? string.Empty);
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    private static string FileName(string title) =>
        (Regex.Replace(title, @"[^\w\-. ]", "").Trim() is { Length: > 0 } name ? name : "dokument") + ".pdf";

    internal static string ContentType(string extension) => extension switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".svg" => "image/svg+xml",
        ".pdf" => "application/pdf",
        ".webp" => "image/webp",
        ".ttf" or ".otf" or ".ttc" => "font/" + extension.TrimStart('.'),
        ".json" => "application/json",
        ".csv" => "text/csv",
        _ => "text/plain",
    };

    [GeneratedRegex("^[a-z][a-z0-9_]{0,39}$")]
    private static partial Regex FieldKey();

    [GeneratedRegex(@"^[\w\-.]+$")]
    private static partial Regex SafeFileName();
}

public record DocumentTemplateSummaryDto(
    Guid Id, string Name, string? Description, bool StoreDocuments, int CurrentVersion,
    int FieldCount, int DocumentCount, DateTimeOffset UpdatedAt);

public record DocumentAssetDto(Guid Id, string FileName, string ContentType, int Size);

public record DocumentTemplateVersionDto(
    int Version, string Source, IList<CustomTableColumn> Fields, IList<DocumentAssetDto> Assets,
    string? Comment, DateTimeOffset CreatedAt, string? CreatedBy);

public record DocumentTemplateDto(
    Guid Id, string Name, string? Description, bool StoreDocuments, int CurrentVersion,
    DocumentTemplateVersionDto Version);

public record DocumentTemplateVersionSummaryDto(int Version, string? Comment, DateTimeOffset CreatedAt, string? CreatedBy);

/// <param name="Fields">Felder; die Id ist der Schlüssel in data.json (a-z, 0-9, _).</param>
/// <param name="AssetIds">Dateien der neuen Version (zuvor hochgeladen).</param>
/// <param name="Comment">Was sich geändert hat (erscheint im Versionsverlauf).</param>
public record SaveDocumentTemplateRequest(
    string Name, string? Description, bool StoreDocuments, string Source,
    IList<CustomTableColumn>? Fields, IList<Guid>? AssetIds, string? Comment);

public record UploadDocumentAssetRequest(string FileName, string ContentBase64);

public record PreviewDocumentTemplateRequest(
    string Source, IList<CustomTableColumn>? Fields, IList<Guid>? AssetIds, JsonElement Values);

public record RenderDocumentRequest(JsonElement Values, string? Title);

public record GeneratedDocumentDto(
    Guid Id, string Title, int TemplateVersion, DateTimeOffset CreatedAt, string? CreatedBy, int Size);

public record TypstErrorDto(string Message);
