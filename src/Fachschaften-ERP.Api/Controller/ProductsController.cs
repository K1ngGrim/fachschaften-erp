using System.Security.Claims;
using System.Text.Json;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/products")]
public class ProductsController(CoreContext db) : ControllerBase
{
    [RequirePermission(PermissionType.ProductsRead)]
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
                InternalSellingPrice = x.InternalSellingPrice,
                ExternalSellingPrice = x.ExternalSellingPrice,
                Unit = x.Unit,
                PriceUnit = x.PriceUnit,
                Stock = 0,
                LowStockThreshold = x.LowStockThreshold,
                TrackStock = x.TrackStock,
                CustomFieldValues = x.CustomFieldValues,
            })
            .ToListAsync();
        
        return Ok(items);
    }

    [RequirePermission(PermissionType.ProductsRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDetailDto>> Get(Guid id)
    {
        var product = await db.Products
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new ProductDetailDto
            {
                Id = x.Id,
                Name = x.Name,
                ItemTypeId = x.ItemTypeId,
                ItemTypeName = x.ItemType!.Name,
                ItemTypeIcon = x.ItemType.Icon,
                SupplierId = x.SupplierId,
                SupplierName = x.Supplier != null ? x.Supplier.Name : null,
                PurchasePrice = x.PurchasePrice,
                InternalSellingPrice = x.InternalSellingPrice,
                ExternalSellingPrice = x.ExternalSellingPrice,
                Unit = x.Unit,
                PriceUnit = x.PriceUnit,
                LowStockThreshold = x.LowStockThreshold,
                TrackStock = x.TrackStock,
                CustomFieldValues = x.CustomFieldValues,
            })
            .FirstOrDefaultAsync();
        if (product is null) return NotFound();

        // Der Bestand ergibt sich aus der Summe der Lagerbewegungen.
        product.Stock = await db.InventoryTransactions
            .Where(x => x.IsActive && x.ProductId == id)
            .SumAsync(x => x.Quantity);

        return Ok(product);
    }

    [RequirePermission(PermissionType.ProductsWrite)]
    [HttpPost]
    public async Task<IActionResult> Upsert(ItemUpsertRequest<ProductDto> request)
    {
        var itemTypeExists = await db.ItemTypes.AnyAsync(x => x.Id == request.Value.ItemTypeId && x.IsActive);
        if (!itemTypeExists) return BadRequest("Invalid ItemTypeId.");

        if (request.Value.SupplierId is not null)
        {
            var supplierExists = await db.Suppliers.AnyAsync(x => x.Id == request.Value.SupplierId && x.IsActive);
            if (!supplierExists) return BadRequest("Invalid SupplierId.");
        }

        var unit = NormalizeUnit(request.Value.Unit);
        var priceUnit = NormalizeUnit(request.Value.PriceUnit);
        if (unit?.Length > ProductBase.MaxUnitLength || priceUnit?.Length > ProductBase.MaxUnitLength)
            return BadRequest($"Units must not be longer than {ProductBase.MaxUnitLength} characters.");

        if (request.Id is null)
        {
            var entity = new ProductEntity
            {
                Id = Guid.NewGuid(),
                Name = request.Value.Name,
                ItemTypeId = request.Value.ItemTypeId,
                SupplierId = request.Value.SupplierId,
                PurchasePrice = request.Value.PurchasePrice,
                InternalSellingPrice = request.Value.InternalSellingPrice,
                ExternalSellingPrice = request.Value.ExternalSellingPrice,
                Unit = unit,
                PriceUnit = priceUnit,
                LowStockThreshold = request.Value.LowStockThreshold,
                TrackStock = request.Value.TrackStock,
                CustomFieldValues = request.Value.CustomFieldValues,
                Created = DateTimeOffset.UtcNow,
                CreatorId = GetUserId(),
                IsActive = true,
            };
            db.Products.Add(entity);

            // Der Bestand ergibt sich aus Lagerbewegungen; ein Anfangsbestand wird als Korrektur gebucht.
            if (entity.TrackStock && request.Value.Stock > 0)
            {
                db.InventoryTransactions.Add(new InventoryTransactionEntity
                {
                    Id = Guid.NewGuid(),
                    ProductId = entity.Id,
                    Quantity = request.Value.Stock,
                    UnitPurchasePrice = entity.PurchasePrice,
                    UnitSellingPrice = entity.InternalSellingPrice,
                    Type = InventoryTransactionType.Adjustment,
                    ReferenceId = entity.Id,
                    Note = "Anfangsbestand",
                    CreatorId = entity.CreatorId,
                    Created = entity.Created,
                    IsActive = true,
                });
            }

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
            entity.InternalSellingPrice = request.Value.InternalSellingPrice;
            entity.ExternalSellingPrice = request.Value.ExternalSellingPrice;
            entity.Unit = unit;
            entity.PriceUnit = priceUnit;
            entity.LowStockThreshold = request.Value.LowStockThreshold;
            entity.TrackStock = request.Value.TrackStock;
            // JsonDocument.ToString() liefert den Typnamen, nicht das JSON; deshalb GetRawText.
            entity.CustomFieldValues = JsonDocument.Parse(request.Value.CustomFieldValues.RootElement.GetRawText());
            entity.Modified = DateTimeOffset.UtcNow;
            entity.ModifierId = GetUserId();

            await db.SaveChangesAsync();
            return Ok(entity);
        }
    }

    [RequirePermission(PermissionType.ProductsWrite)]
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

    private static string? NormalizeUnit(string? unit) =>
        string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();

    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
}

public class ProductDto : ProductBase
{
    public new Guid? Id { get; set; }
    public int Stock { get; set; }
}

/// <summary>Artikel mit Namen von Typ und Lieferant, damit die Detailseite keine weiteren Rechte braucht.</summary>
public class ProductDetailDto : ProductDto
{
    public string ItemTypeName { get; set; } = string.Empty;
    public string? ItemTypeIcon { get; set; }
    public string? SupplierName { get; set; }
}