using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/deliveries")]
public class DeliveriesController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<DeliveryOverviewDto>>> GetAll()
    {
        var deliveries = await db.Deliveries
            .Where(x => x.IsActive)
            .Include(x => x.Supplier)
            .Include(x => x.Positions)
            .OrderByDescending(x => x.DeliveryDate)
            .Select(x => new DeliveryOverviewDto(
                x.Id,
                x.SupplierId,
                x.Supplier.Name,
                x.DeliveryDate,
                x.DocumentNumber,
                x.ReceiptUrl,
                x.Positions.Count,
                x.Positions.Sum(p => p.Quantity),
                x.Positions.Sum(p => p.Quantity * p.UnitPurchasePrice)
            ))
            .ToListAsync();

        return Ok(deliveries);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DeliveryDto>> Get(Guid id)
    {
        var entity = await db.Deliveries
            .Include(x => x.Positions)
            .FirstOrDefaultAsync(x => x.Id == id && x.IsActive);

        return entity is null ? NotFound() : Ok(ToDto(entity));
    }

    [HttpPost]
    public async Task<ActionResult<DeliveryDto>> Upsert(ItemUpsertRequest<DeliveryDto> request)
    {
        var invoker = (Invoker)User;

        if (request.Value.Positions.Count == 0)
            return BadRequest("A delivery needs at least one position.");

        var supplierExists = await db.Suppliers.AnyAsync(x => x.Id == request.Value.SupplierId && x.IsActive);
        if (!supplierExists) return BadRequest("Invalid SupplierId.");

        var productIds = request.Value.Positions.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(x => x.IsActive && productIds.Contains(x.Id))
            .ToListAsync();

        if (products.Count != productIds.Count)
            return BadRequest("One or more products do not exist.");

        var now = DateTimeOffset.UtcNow;

        var entity = request.Id.HasValue
            ? await db.Deliveries
                .Include(x => x.Positions)
                .FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive)
            : null;

        if (request.Id.HasValue && entity is null) return NotFound();

        if (entity is null)
        {
            entity = new DeliveryEntity
            {
                Id = Guid.NewGuid(),
                Created = now,
                CreatorId = invoker.UserId,
                IsActive = true,
            };
            db.Deliveries.Add(entity);
        }
        else
        {
            entity.Modified = now;
            entity.ModifierId = invoker.UserId;

            db.DeliveryPositions.RemoveRange(entity.Positions);
            await DeactivateTransactionsAsync(entity.Id, invoker.UserId, now);
        }

        entity.SupplierId = request.Value.SupplierId;
        entity.DeliveryDate = request.Value.DeliveryDate;
        entity.DocumentNumber = request.Value.DocumentNumber;
        entity.ReceiptUrl = request.Value.ReceiptUrl;
        entity.Note = request.Value.Note;

        foreach (var position in request.Value.Positions)
        {
            var product = products.First(x => x.Id == position.ProductId);

            db.DeliveryPositions.Add(new DeliveryPositionEntity
            {
                Id = Guid.NewGuid(),
                DeliveryId = entity.Id,
                ProductId = product.Id,
                Quantity = position.Quantity,
                UnitPurchasePrice = position.UnitPurchasePrice,
            });

            db.InventoryTransactions.Add(new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Quantity = position.Quantity,
                UnitPurchasePrice = position.UnitPurchasePrice,
                UnitSellingPrice = product.InternalSellingPrice,
                Type = InventoryTransactionType.Delivery,
                ReferenceId = entity.Id,
                Note = entity.DocumentNumber,
                CreatorId = invoker.UserId,
                Created = now,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync();

        var saved = await db.Deliveries
            .Include(x => x.Positions)
            .FirstAsync(x => x.Id == entity.Id);

        return request.Id.HasValue
            ? Ok(ToDto(saved))
            : CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.Deliveries.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        var now = DateTimeOffset.UtcNow;

        entity.IsActive = false;
        entity.Modified = now;
        entity.ModifierId = invoker.UserId;

        await DeactivateTransactionsAsync(entity.Id, invoker.UserId, now);

        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task DeactivateTransactionsAsync(Guid deliveryId, Guid userId, DateTimeOffset now)
    {
        var transactions = await db.InventoryTransactions
            .Where(x => x.IsActive && x.ReferenceId == deliveryId)
            .ToListAsync();

        foreach (var transaction in transactions)
        {
            transaction.IsActive = false;
            transaction.Modified = now;
            transaction.ModifierId = userId;
        }
    }

    private static DeliveryDto ToDto(DeliveryEntity entity) => new()
    {
        Id = entity.Id,
        SupplierId = entity.SupplierId,
        DeliveryDate = entity.DeliveryDate,
        DocumentNumber = entity.DocumentNumber,
        ReceiptUrl = entity.ReceiptUrl,
        Note = entity.Note,
        Positions = entity.Positions
            .Select(p => new DeliveryPositionDto(p.ProductId, p.Quantity, p.UnitPurchasePrice))
            .ToList(),
    };
}

public class DeliveryDto : DeliveryBase
{
    public IList<DeliveryPositionDto> Positions { get; set; } = [];
}

public record DeliveryPositionDto(Guid ProductId, int Quantity, decimal UnitPurchasePrice);

public record DeliveryOverviewDto(
    Guid Id,
    Guid SupplierId,
    string SupplierName,
    DateTimeOffset DeliveryDate,
    string? DocumentNumber,
    string? ReceiptUrl,
    int PositionCount,
    int TotalQuantity,
    decimal TotalAmount);
