using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/inventory-transactions")]
public class InventoryTransactionsController(
    CoreContext db
    ): ControllerBase
{
    
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<InventoryTransactionDto>> Get(Guid id)
    {

        return Ok();
    }
    
    [HttpGet("product/{productId:guid}")]
    public async Task<ActionResult<IList<SimpleInventoryTransactionDto>>> GetProductTransactions(Guid productId)
    {
        var productPrice = await db.Products
            .Where(x => x.IsActive && x.Id == productId)
            .Select(x => x.InternalSellingPrice)
            .FirstOrDefaultAsync();

        var entries = await db.InventoryTransactions
            .Where(x => x.IsActive && x.ProductId == productId)
            .Select(x => new SimpleInventoryTransactionDto(
                x.Id,
                x.ProductId,
                x.Created,
                x.Type,
                x.Quantity,
                x.Quantity * productPrice
            ))
            .ToListAsync();

        return Ok(entries);
    }

    [HttpPost]
    public async Task<IActionResult> Upsert(ItemUpsertRequest<InventoryTransactionDto> request)
    {
        
        var invoker = (Invoker)User;
        
        if (await db.Products.AnyAsync(x => x.IsActive && x.Id == request.Value.ProductId) == false)
        {
            return BadRequest("Product does not exist");
        }
        
        var pricing = await db.Products
            .Where(x => x.IsActive && x.Id == request.Value.ProductId)
            .Select(x => new
            {
                SellingPrice = x.InternalSellingPrice,
                x.PurchasePrice
            })
            .FirstOrDefaultAsync();

        if (pricing is null)
        {
            return BadRequest("Product does not have pricing information");
        }
        
        var existing = request.Id.HasValue
            ? await db.InventoryTransactions
                .FirstOrDefaultAsync(x => x.Id == request.Value.Id && x.IsActive)
            : null;

        if (existing is null)
        {

            var entity = new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(),
                ProductId = request.Value.ProductId,
                Quantity = request.Value.Quantity,
                
                UnitSellingPrice = pricing.SellingPrice,
                UnitPurchasePrice = pricing.PurchasePrice,
                
                Type = request.Value.Type,
                Note = request.Value.Note,
                CreatorId = invoker.UserId,
                Created = DateTimeOffset.UtcNow,
                IsActive = true,
            };
            
            db.InventoryTransactions.Add(entity);
            await db.SaveChangesAsync();
            
            return CreatedAtAction(nameof(Get), new { id = entity.Id }, new InventoryTransactionDto(
                entity.Id,
                entity.ProductId,
                entity.Created,
                entity.Type,
                entity.Quantity,
                entity.Quantity * entity.UnitSellingPrice,
                entity.Note
            ));
        }

        existing.Modified = DateTimeOffset.UtcNow;
        existing.ModifierId = invoker.UserId;
            
        existing.Quantity = request.Value.Quantity;
        existing.Type = request.Value.Type;
        existing.Note = request.Value.Note;
        existing.ProductId = request.Value.ProductId;
        
        await db.SaveChangesAsync();
            
        return Ok(new InventoryTransactionDto(
            existing.Id,
            existing.ProductId,
            existing.Created,
            existing.Type,
            existing.Quantity,
            existing.Quantity * existing.UnitSellingPrice,
            existing.Note
        ));

    }
}

public record InventoryTransactionDto(Guid Id, Guid ProductId, DateTimeOffset Date, InventoryTransactionType Type, int Quantity, decimal Amount, string? Note);
public record SimpleInventoryTransactionDto(Guid Id, Guid ProductId, DateTimeOffset Date, InventoryTransactionType Type, int Quantity, decimal Amount);