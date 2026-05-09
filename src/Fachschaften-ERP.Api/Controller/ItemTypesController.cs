using System.Security.Claims;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/item-types")]
public class ItemTypesController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.ItemTypes.Where(x => x.IsActive).ToListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var entity = await db.ItemTypes.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpPut("{id:guid?}")]
    public async Task<IActionResult> Upsert(Guid? id, UpsertItemTypeRequest request)
    {
        if (id is null)
        {
            var entity = new ItemTypeEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                Icon = request.Icon,
                Created = DateTimeOffset.UtcNow,
                CreatorId = GetUserId(),
                IsActive = true,
            };
            db.ItemTypes.Add(entity);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = entity.Id }, entity);
        }
        else
        {
            var entity = await db.ItemTypes.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Name;
            entity.Icon = request.Icon;
            entity.Modified = DateTimeOffset.UtcNow;
            entity.ModifierId = GetUserId();

            await db.SaveChangesAsync();
            return Ok(entity);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await db.ItemTypes.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = GetUserId();

        await db.SaveChangesAsync();
        return NoContent();
    }

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
}

public record UpsertItemTypeRequest(string Name, string? Icon);