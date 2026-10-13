using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/wiki")]
public class WikiController(CoreContext db) : ControllerBase
{
    private const int MaxContentLength = 200_000;

    [RequirePermission(PermissionType.WikiRead)]
    [HttpGet]
    public async Task<ActionResult<IList<WikiPageSummaryDto>>> GetAll()
    {
        var pages = await db.WikiPages
            .Where(p => p.IsActive)
            .OrderBy(p => p.Category)
            .ThenBy(p => p.Title)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Category,
                UpdatedAt = p.Modified ?? p.Created,
                UpdatedById = p.ModifierId ?? p.CreatorId,
            })
            .ToListAsync();

        var names = await UserNamesAsync(pages.Select(p => p.UpdatedById));
        return Ok(pages
            .Select(p => new WikiPageSummaryDto(p.Id, p.Title, p.Category, p.UpdatedAt,
                names.GetValueOrDefault(p.UpdatedById)))
            .ToList());
    }

    [RequirePermission(PermissionType.WikiRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WikiPageDto>> Get(Guid id)
    {
        var page = await db.WikiPages.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (page is null) return NotFound();

        return Ok(await ToDtoAsync(page));
    }

    [RequirePermission(PermissionType.WikiWrite)]
    [HttpPost]
    public async Task<ActionResult<WikiPageDto>> Create(UpsertWikiPageRequest request)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var page = new WikiPageEntity
        {
            Id = Guid.NewGuid(),
            CreatorId = ((Invoker)User).UserId,
            Created = DateTimeOffset.UtcNow,
            IsActive = true,
        };
        Apply(page, request);

        db.WikiPages.Add(page);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = page.Id }, await ToDtoAsync(page));
    }

    [RequirePermission(PermissionType.WikiWrite)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WikiPageDto>> Update(Guid id, UpsertWikiPageRequest request)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(error);

        var page = await db.WikiPages.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (page is null) return NotFound();

        Apply(page, request);
        page.ModifierId = ((Invoker)User).UserId;
        page.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Ok(await ToDtoAsync(page));
    }

    [RequirePermission(PermissionType.WikiWrite)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var page = await db.WikiPages.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (page is null) return NotFound();

        page.IsActive = false;
        page.ModifierId = ((Invoker)User).UserId;
        page.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static string? Validate(UpsertWikiPageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (request.Title.Trim().Length > 200) return "Title is too long.";
        if (request.Category?.Trim().Length > 100) return "Category is too long.";
        if ((request.Content ?? string.Empty).Length > MaxContentLength) return "Content is too long.";
        return null;
    }

    private static void Apply(WikiPageEntity page, UpsertWikiPageRequest request)
    {
        page.Title = request.Title.Trim();
        page.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        page.Content = request.Content ?? string.Empty;
    }

    private async Task<WikiPageDto> ToDtoAsync(WikiPageEntity page)
    {
        var names = await UserNamesAsync([page.CreatorId, page.ModifierId ?? page.CreatorId]);
        return new WikiPageDto(
            page.Id,
            page.Title,
            page.Category,
            page.Content,
            page.Created,
            names.GetValueOrDefault(page.CreatorId),
            page.Modified ?? page.Created,
            names.GetValueOrDefault(page.ModifierId ?? page.CreatorId));
    }

    private async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return await db.Users
            .Where(u => distinct.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.UserName ?? string.Empty);
    }
}

public record WikiPageSummaryDto(Guid Id, string Title, string? Category, DateTimeOffset UpdatedAt, string? UpdatedBy);

public record WikiPageDto(
    Guid Id,
    string Title,
    string? Category,
    string Content,
    DateTimeOffset CreatedAt,
    string? CreatedBy,
    DateTimeOffset UpdatedAt,
    string? UpdatedBy);

public record UpsertWikiPageRequest(string Title, string? Category, string? Content);
