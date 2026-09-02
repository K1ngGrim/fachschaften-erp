using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/booking-categories")]
public class BookingCategoriesController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<BookingCategoryDto>>> GetAll([FromQuery] TaxArea? taxArea)
    {
        var categories = await db.BookingCategories
            .Where(x => x.IsActive && (taxArea == null || x.TaxArea == taxArea))
            .OrderBy(x => x.TaxArea)
            .ThenBy(x => x.Name)
            .Select(x => new BookingCategoryDto
            {
                Id = x.Id,
                Name = x.Name,
                TaxArea = x.TaxArea,
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingCategoryDto>> Get(Guid id)
    {
        var entity = await db.BookingCategories
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new BookingCategoryDto
            {
                Id = x.Id,
                Name = x.Name,
                TaxArea = x.TaxArea,
            })
            .FirstOrDefaultAsync();

        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpPost]
    public async Task<ActionResult<BookingCategoryDto>> Upsert(ItemUpsertRequest<BookingCategoryDto> request)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        if (string.IsNullOrWhiteSpace(request.Value.Name))
            return BadRequest("Name is required.");

        if (request.Id is null)
        {
            var entity = new BookingCategoryEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Value.Name,
                TaxArea = request.Value.TaxArea,
                Created = now,
                CreatorId = invoker.UserId,
                IsActive = true,
            };

            db.BookingCategories.Add(entity);
            await db.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = entity.Id }, new BookingCategoryDto
            {
                Id = entity.Id,
                Name = entity.Name,
                TaxArea = entity.TaxArea,
            });
        }
        else
        {
            var entity = await db.BookingCategories.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Value.Name;
            entity.TaxArea = request.Value.TaxArea;
            entity.Modified = now;
            entity.ModifierId = invoker.UserId;

            await db.SaveChangesAsync();

            return Ok(new BookingCategoryDto
            {
                Id = entity.Id,
                Name = entity.Name,
                TaxArea = entity.TaxArea,
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.BookingCategories.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        var inUse = await db.Bookings.AnyAsync(x => x.IsActive && x.CategoryId == id);
        if (inUse) return BadRequest("Category is still used by bookings.");

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }
}

public class BookingCategoryDto : BookingCategoryBase;
