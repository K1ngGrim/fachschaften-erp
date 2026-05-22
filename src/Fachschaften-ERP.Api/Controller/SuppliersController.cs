using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/suppliers")]
public class SuppliersController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<SupplierDto>>> GetAll()
    {
        var suppliers = await db.Suppliers
            .Where(x => x.IsActive)
            .Select(x => new SupplierDto
            {
                Id = x.Id,
                Name = x.Name,
            })
            .ToListAsync();

        return Ok(suppliers);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<IList<SupplierDto>>> Get(Guid id)
    {
        var entity = await db.Suppliers
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new SupplierDto
            {
                Id = x.Id,
                Name = x.Name,
            })
            .FirstOrDefaultAsync();

        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> Upsert(UpsertSupplierRequest request)
    {

        var invoker = (Invoker)User;

        if (request.Id is null)
        {
            var entity = new SupplierEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                Created = DateTimeOffset.UtcNow,
                CreatorId = invoker.UserId,
                IsActive = true,
            };
            db.Suppliers.Add(entity);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = entity.Id }, new SupplierDto
            {
                Id = entity.Id,
                Name = entity.Name
            });
        }
        else
        {
            var entity = await db.Suppliers.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Name;
            entity.Modified = DateTimeOffset.UtcNow;
            entity.ModifierId = invoker.UserId;

            await db.SaveChangesAsync();
            return Ok(new SupplierDto
            {
                Id = entity.Id,
                Name = entity.Name
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.Suppliers.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }
}

public class SupplierDto : SupplierBase;
public record UpsertSupplierRequest(Guid? Id, string Name);