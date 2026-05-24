using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/custom-fields")]
public class CustomFieldsController(
    CoreContext db
    ): ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetAll()
    {        
        var fields = await db.CustomFields
            .Where(x => x.IsActive)
            .Include(x => x.ItemTypes)
            .OrderBy(x => x.Order)
            .ToListAsync();

        var result = fields.Select(x => new CustomFieldDto
        {
            Id = x.Id,
            Name = x.Name,
            Type = x.Type,
            Order = x.Order,
            Label = x.Label,
            Required = x.Required,
            SelectOptions = x.SelectOptions,
            ItemTypes = x.ItemTypes.Select(t => new ItemTypeBase
            {
                Id = t.Id,
                Name = t.Name,
            }).ToList(),
        }).ToList();

        return Ok(result);
    }
    
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        return Ok();
    }

    [HttpGet("type/{typeId:guid}")]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetByType(Guid typeId)
    {
        var itemType = await db.ItemTypes
            .Where(x => x.IsActive)
            .SingleOrDefaultAsync();
        
        if (itemType is null) return NotFound();

        var fields = await db.CustomFields
            .Where(x => x.ItemTypes.Any(x => x.Id == itemType.Id))
            .Select(x => new CustomFieldDto
            {
                Id = x.Id,
                Name = x.Name,
                Type = x.Type,
                Order = x.Order,
                Label = x.Label,
                Required = x.Required,
                SelectOptions = x.SelectOptions,
            })
            .ToListAsync();
        
        return Ok(fields);
    }
    
    [HttpPost]
    public async Task<IActionResult> Upsert(ItemUpsertRequest<CustomFieldDto> request)
    {
        var invoker = (Invoker)User;
        
        var itemTypeIds = request.Value.ItemTypes?.Select(t => t.Id).ToList() ?? [];
        var itemTypes = await db.ItemTypes
            .Where(t => itemTypeIds.Contains(t.Id))
            .ToListAsync();

        var existing = request.Id.HasValue
            ? await db.CustomFields
                .Include(x => x.ItemTypes)
                .FirstOrDefaultAsync(x => x.Id == request.Value.Id && x.IsActive)
            : null;

        if (existing is null)
        {
            var entity = new CustomFieldEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Value.Name,
                Label = request.Value.Label,
                Type = request.Value.Type,
                Required = request.Value.Required,
                Order = request.Value.Order,
                SelectOptions = request.Value.SelectOptions ?? [],
                ItemTypes = itemTypes,
                Created = DateTimeOffset.UtcNow,
                CreatorId = invoker.UserId,
                IsActive = true,
            };
            db.CustomFields.Add(entity);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = entity.Id }, new CustomFieldDto
            {
                Id = entity.Id,
                Name = entity.Name,
                Label = entity.Label,
                Type = entity.Type,
                Required = entity.Required,
                Order = entity.Order,
                SelectOptions = entity.SelectOptions,
                ItemTypes = entity.ItemTypes.Select(t => new ItemTypeBase
                {
                    Id = t.Id,
                    Name = t.Name,
                }).ToList(),
            });
        }

        existing.Name = request.Value.Name;
        existing.Label = request.Value.Label;
        existing.Type = request.Value.Type;
        existing.Required = request.Value.Required;
        existing.Order = request.Value.Order;
        existing.SelectOptions = request.Value.SelectOptions ?? [];
        existing.ItemTypes = itemTypes;
        existing.Modified = DateTimeOffset.UtcNow;
        existing.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return Ok(new CustomFieldDto
        {
            Id = existing.Id,
            Name = existing.Name,
            Label = existing.Label,
            Type = existing.Type,
            Required = existing.Required,
            Order = existing.Order,
            SelectOptions = existing.SelectOptions,
            ItemTypes = existing.ItemTypes.Select(t => new ItemTypeBase
            {
                Id = t.Id,
                Name = t.Name,
            }).ToList(),
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;
        
        var entity = await db.CustomFields.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }
}

public class CustomFieldDto : CustomFieldBase
{
    public IList<ItemTypeBase> ItemTypes { get; set; } = [];
}