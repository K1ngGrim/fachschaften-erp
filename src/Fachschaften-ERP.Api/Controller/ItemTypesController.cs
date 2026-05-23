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
    
    [HttpGet("{typeId:guid}/custom-fields")]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetCustomFields(Guid typeId)
    {
        var itemType = await db.ItemTypes
            .Include(x => x.CustomFields)
            .SingleOrDefaultAsync(x => x.Id == typeId && x.IsActive);

        if (itemType is null) return NotFound();

        var customFields = itemType.CustomFields
            .Where(x => x.IsActive)
            .Select(x => new CustomFieldDto
            {
                Id = x.Id,
                Name = x.Name,
                Label = x.Label,
                Type = x.Type,
                Required = x.Required,
                Order = x.Order,
                SelectOptions = x.SelectOptions,
                ItemTypes = db.ItemTypes
                    .Where(y => y.IsActive)
                    .Select(t => new ItemTypeBase
                {
                    Id = t.Id,
                    Name = t.Name,
                }).ToList(),
            })
            .OrderBy(cf => cf.Order)
            .ToList();

        return Ok(customFields);
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