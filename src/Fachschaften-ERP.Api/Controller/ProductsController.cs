using System.Security.Claims;
using System.Text.Json;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/products")]
public class ProductsController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<ProductDto>>> GetAll()
    {
        var items = await db.Products
            .Include(x => x.ItemType)
            .Include(x => x.Supplier)
            .Where(x => x.IsActive)
            .Select(x => new ProductDto
            {
                Id = x.Id,
                Name = x.Name,
                ItemTypeId = x.ItemTypeId,
                SupplierId = x.SupplierId,
                PurchasePrice = x.PurchasePrice,
                SellingPrice = x.SellingPrice,
                Stock = x.Stock,
                LowStockThreshold = x.LowStockThreshold,
                TrackStock = x.TrackStock,
                CustomFieldValues = x.CustomFieldValues,
            })
            .ToListAsync();
        
        return Ok(items);
    }
    
    [HttpGet("{id:guid}/custom-fields")]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetCustomFields(Guid id)
    {
        var product = await db.Products
            .Include(x => x.ItemType)
            .ThenInclude(it => it.CustomFields)
            .FirstOrDefaultAsync(x => x.Id == id && x.IsActive);

        if (product is null) return NotFound();

        var customFields = product.ItemType.CustomFields
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

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var entity = await db.Products
            .Include(x => x.ItemType)
            .Include(x => x.Supplier)
            .FirstOrDefaultAsync(x => x.Id == id && x.IsActive);

        return entity is null ? NotFound() : Ok(entity);
    }

    [HttpPut("{id:guid?}")]
    public async Task<IActionResult> Upsert(ItemUpsertRequest<ProductDto> request)
    {
        var itemTypeExists = await db.ItemTypes.AnyAsync(x => x.Id == request.Value.ItemTypeId && x.IsActive);
        if (!itemTypeExists) return BadRequest("Invalid ItemTypeId.");

        if (request.Value.SupplierId is not null)
        {
            var supplierExists = await db.Suppliers.AnyAsync(x => x.Id == request.Value.SupplierId && x.IsActive);
            if (!supplierExists) return BadRequest("Invalid SupplierId.");
        }

        if (request.Id is null)
        {
            var entity = new ProductEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Value.Name,
                ItemTypeId = request.Value.ItemTypeId,
                SupplierId = request.Value.SupplierId,
                PurchasePrice = request.Value.PurchasePrice,
                SellingPrice = request.Value.SellingPrice,
                Stock = request.Value.Stock,
                LowStockThreshold = request.Value.LowStockThreshold,
                TrackStock = request.Value.TrackStock,
                CustomFieldValues = JsonDocument.Parse(request.Value.CustomFieldValues.ToString() ?? "{}"),
                Created = DateTimeOffset.UtcNow,
                CreatorId = GetUserId(),
                IsActive = true,
            };
            db.Products.Add(entity);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = entity.Id }, entity);
        }
        else
        {
            var entity = await db.Products.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Value.Name;
            entity.ItemTypeId = request.Value.ItemTypeId;
            entity.SupplierId = request.Value.SupplierId;
            entity.PurchasePrice = request.Value.PurchasePrice;
            entity.SellingPrice = request.Value.SellingPrice;
            entity.Stock = request.Value.Stock;
            entity.LowStockThreshold = request.Value.LowStockThreshold;
            entity.TrackStock = request.Value.TrackStock;
            entity.CustomFieldValues = JsonDocument.Parse(request.Value.CustomFieldValues.ToString() ?? "{}");
            entity.Modified = DateTimeOffset.UtcNow;
            entity.ModifierId = GetUserId();

            await db.SaveChangesAsync();
            return Ok(entity);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await db.Products.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
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
public class ProductDto : ProductBase;