using System.Security.Claims;
using System.Text.Json;
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
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Products
            .Where(x => x.IsActive)
            .Include(x => x.ItemType)
            .Include(x => x.Supplier)
            .ToListAsync());

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
    public async Task<IActionResult> Upsert(Guid? id, UpsertProductRequest request)
    {
        var itemTypeExists = await db.ItemTypes.AnyAsync(x => x.Id == request.ItemTypeId && x.IsActive);
        if (!itemTypeExists) return BadRequest("Invalid ItemTypeId.");

        if (request.SupplierId is not null)
        {
            var supplierExists = await db.Suppliers.AnyAsync(x => x.Id == request.SupplierId && x.IsActive);
            if (!supplierExists) return BadRequest("Invalid SupplierId.");
        }

        if (id is null)
        {
            var entity = new ProductEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Name,
                ItemTypeId = request.ItemTypeId,
                SupplierId = request.SupplierId,
                PurchasePrice = request.PurchasePrice,
                SellingPrice = request.SellingPrice,
                Stock = request.Stock,
                LowStockThreshold = request.LowStockThreshold,
                TrackStock = request.TrackStock,
                CustomFieldValues = request.CustomFieldValues is not null
                    ? JsonDocument.Parse(request.CustomFieldValues)
                    : JsonDocument.Parse("{}"),
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
            var entity = await db.Products.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
            if (entity is null) return NotFound();

            entity.Name = request.Name;
            entity.ItemTypeId = request.ItemTypeId;
            entity.SupplierId = request.SupplierId;
            entity.PurchasePrice = request.PurchasePrice;
            entity.SellingPrice = request.SellingPrice;
            entity.Stock = request.Stock;
            entity.LowStockThreshold = request.LowStockThreshold;
            entity.TrackStock = request.TrackStock;
            entity.CustomFieldValues = request.CustomFieldValues is not null
                ? JsonDocument.Parse(request.CustomFieldValues)
                : JsonDocument.Parse("{}");
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

public record UpsertProductRequest(
    string Name,
    Guid ItemTypeId,
    Guid? SupplierId,
    decimal PurchasePrice,
    decimal SellingPrice,
    int Stock,
    int LowStockThreshold,
    bool TrackStock,
    string? CustomFieldValues  // JSON string, z.B. "{\"color\":\"black\"}"
);