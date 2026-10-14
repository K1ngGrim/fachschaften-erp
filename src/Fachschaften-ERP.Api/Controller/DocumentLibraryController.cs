using System.Text.RegularExpressions;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Modules;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Was alle Vorlagen gemeinsam nutzen: Dateien (in Vorlagen unter <c>/template/…</c>) und
/// Variablen (in Vorlagen unter <c>daten.variablen.…</c>).
/// </summary>
[ApiController]
[Route("/api/documents")]
[RequireModule(AppModules.Documents)]
public partial class DocumentLibraryController(CoreContext db) : ControllerBase
{
    private const int MaxFileBytes = 10 * 1024 * 1024;
    private const long MaxTotalBytes = 200L * 1024 * 1024;
    private const int MaxVariables = 200;

    // ── Gemeinsame Dateien ──────────────────────────────────────────────────

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("public-files")]
    public async Task<ActionResult<IList<DocumentPublicFileDto>>> GetPublicFiles() =>
        Ok(await db.DocumentPublicFiles
            .OrderBy(f => f.Path)
            .Select(f => new DocumentPublicFileDto(f.Id, f.Path, f.ContentType, f.Data.Length, f.Modified ?? f.Created))
            .ToListAsync());

    /// <summary>Lädt eine Datei hoch; eine vorhandene Datei mit gleichem Pfad wird ersetzt.</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPost("public-files")]
    public async Task<ActionResult<DocumentPublicFileDto>> UploadPublicFile(UploadDocumentPublicFileRequest request)
    {
        var path = NormalizePath(request.Path);
        if (path is null)
            return BadRequest("Invalid path: use folders and file names with letters, digits, spaces, '-', '_' and '.'.");
        var extension = Path.GetExtension(path).ToLowerInvariant();
        if (!DocumentsController.AllowedExtensions.Contains(extension))
            return BadRequest($"Files of type '{extension}' are not allowed.");

        byte[] data;
        try
        {
            data = Convert.FromBase64String(request.ContentBase64);
        }
        catch (FormatException)
        {
            return BadRequest("Content must be Base64.");
        }
        if (data.Length is 0 or > MaxFileBytes) return BadRequest("Files must be between 1 byte and 10 MB.");

        var file = await db.DocumentPublicFiles.FirstOrDefaultAsync(f => f.Path == path);
        var used = await db.DocumentPublicFiles.Where(f => f.Path != path).SumAsync(f => (long)f.Data.Length);
        if (used + data.Length > MaxTotalBytes) return BadRequest("All shared files together may not exceed 200 MB.");

        var userId = ((Invoker)User).UserId;
        var now = DateTimeOffset.UtcNow;
        if (file is null)
        {
            file = new DocumentPublicFileEntity { Id = Guid.NewGuid(), Path = path, CreatorId = userId, Created = now };
            db.DocumentPublicFiles.Add(file);
        }
        else
        {
            file.ModifierId = userId;
            file.Modified = now;
        }
        file.ContentType = DocumentsController.ContentType(extension);
        file.Data = data;
        await db.SaveChangesAsync();

        return Ok(new DocumentPublicFileDto(file.Id, file.Path, file.ContentType, data.Length, file.Modified ?? file.Created));
    }

    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpDelete("public-files/{id:guid}")]
    public async Task<IActionResult> DeletePublicFile(Guid id)
    {
        var deleted = await db.DocumentPublicFiles.Where(f => f.Id == id).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound() : NoContent();
    }

    /// <summary>Löscht alle Dateien eines Ordners (samt Unterordnern).</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpDelete("public-files")]
    public async Task<ActionResult<int>> DeletePublicFolder([FromQuery] string folder)
    {
        var path = NormalizePath(folder);
        if (path is null) return BadRequest("Invalid folder.");
        var prefix = path + "/";
        return Ok(await db.DocumentPublicFiles.Where(f => f.Path.StartsWith(prefix)).ExecuteDeleteAsync());
    }

    // ── Variablen ───────────────────────────────────────────────────────────

    [RequirePermission(PermissionType.DocumentsRead)]
    [HttpGet("variables")]
    public async Task<ActionResult<IList<DocumentVariableDto>>> GetVariables() =>
        Ok(await db.DocumentVariables
            .OrderBy(v => v.SortOrder).ThenBy(v => v.Key)
            .Select(v => new DocumentVariableDto(v.Key, v.Value, v.Description))
            .ToListAsync());

    /// <summary>Ersetzt alle Variablen (Reihenfolge wie übergeben).</summary>
    [RequirePermission(PermissionType.DocumentTemplatesWrite)]
    [HttpPut("variables")]
    public async Task<ActionResult<IList<DocumentVariableDto>>> SaveVariables(IList<DocumentVariableDto> variables)
    {
        if (variables.Count > MaxVariables) return BadRequest($"At most {MaxVariables} variables are allowed.");
        var keys = new HashSet<string>();
        foreach (var variable in variables)
        {
            var key = variable.Key?.Trim() ?? string.Empty;
            if (!VariableKey().IsMatch(key))
                return BadRequest($"Variable '{key}': start with a letter, then only a-z, 0-9 and '_'.");
            if (!keys.Add(key)) return BadRequest($"Variable '{key}' is used twice.");
            if ((variable.Value ?? string.Empty).Length > 5000) return BadRequest($"Variable '{key}' is too long.");
            if (variable.Description?.Length > 300) return BadRequest($"Description of '{key}' is too long.");
        }

        db.DocumentVariables.RemoveRange(await db.DocumentVariables.ToListAsync());
        db.DocumentVariables.AddRange(variables.Select((v, i) => new DocumentVariableEntity
        {
            Key = v.Key.Trim(),
            Value = v.Value ?? string.Empty,
            Description = string.IsNullOrWhiteSpace(v.Description) ? null : v.Description.Trim(),
            SortOrder = i,
        }));
        await db.SaveChangesAsync();
        return await GetVariables();
    }

    /// <summary>
    /// Relativer Pfad mit "/" als Trenner; keine leeren, "."- oder ".."-Teile, nur harmlose Zeichen.
    /// </summary>
    private static string? NormalizePath(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var parts = raw.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim()).ToList();
        if (parts.Count is 0 or > 10 ||
            parts.Any(p => p is "." or ".." || !PathPart().IsMatch(p) || p.Length > 100))
            return null;
        var path = string.Join('/', parts);
        return path.Length > 300 ? null : path;
    }

    [GeneratedRegex(@"^[\w\-. ()]+$")]
    private static partial Regex PathPart();

    [GeneratedRegex("^[a-z][a-z0-9_]{0,39}$")]
    private static partial Regex VariableKey();
}

public record DocumentPublicFileDto(Guid Id, string Path, string ContentType, int Size, DateTimeOffset UpdatedAt);

/// <param name="Path">Relativer Pfad samt Unterordnern, z. B. "logos/fachschaft.png".</param>
public record UploadDocumentPublicFileRequest(string Path, string ContentBase64);

/// <param name="Key">Name in Vorlagen: <c>daten.variablen.&lt;key&gt;</c>.</param>
public record DocumentVariableDto(string Key, string Value, string? Description);
