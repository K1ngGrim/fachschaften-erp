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
    public async Task<ActionResult<IList<ItemTypeDto>>> GetAll()
    {
        var types = await db.ItemTypes
            .Where(x => x.IsActive)
            .Select(x => new ItemTypeDto(x.Id, x.Name, x.Icon))
            .ToListAsync();


        return Ok(types);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var entity = await db.ItemTypes.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpPost]
    public async Task<ActionResult<ItemTypeDto>> Upsert([FromBody] UpsertItemTypeRequest request)
    {
        if (request.Id is null)
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
            return CreatedAtAction(
                nameof(Get), 
                new { id = entity.Id }, 
                new ItemTypeDto(entity.Id, entity.Name, entity.Icon)
                );
        }
        else
        {
            var entity = await db.ItemTypes.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Name;
            entity.Icon = request.Icon;
            entity.Modified = DateTimeOffset.UtcNow;
            entity.ModifierId = GetUserId();

            await db.SaveChangesAsync();
            return Ok(new ItemTypeDto(entity.Id, entity.Name, entity.Icon));
        }
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

public record ItemTypeDto(Guid Id, string Name, string? Icon);
public record UpsertItemTypeRequest(Guid? Id, string Name, string? Icon);