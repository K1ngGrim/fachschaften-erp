using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/stock")]
public class StockController(
    CoreContext db
    ): ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IList<StockOverviewDto>>> GetAll()
    {
        return Ok(await GetOverviewAsync());
    }

    [HttpPost("update")]
    public async Task<ActionResult<IList<StockOverviewDto>>> Update(StockUpdateRequest request)
    {
        var invoker = (Invoker)User;

        var productIds = request.Positions.Select(x => x.ProductId).Distinct().ToList();

        var products = await db.Products
            .Where(x => x.IsActive && productIds.Contains(x.Id))
            .ToListAsync();

        if (products.Count != productIds.Count)
            return BadRequest("One or more products do not exist.");

        var currentStock = await GetStockByProductAsync(productIds);

        var referenceId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        foreach (var position in request.Positions)
        {
            var product = products.First(x => x.Id == position.ProductId);
            currentStock.TryGetValue(position.ProductId, out var stock);

            var difference = position.NewStock - stock;
            if (difference == 0) continue;

            db.InventoryTransactions.Add(new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Quantity = difference,
                UnitPurchasePrice = product.PurchasePrice,
                UnitSellingPrice = product.InternalSellingPrice,
                Type = position.Type,
                ReferenceId = referenceId,
                Note = position.Note ?? request.Note,
                CreatorId = invoker.UserId,
                Created = now,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync();

        return Ok(await GetOverviewAsync());
    }

    private async Task<IList<StockOverviewDto>> GetOverviewAsync()
    {
        var products = await db.Products
            .Where(x => x.IsActive)
            .ToListAsync();

        var stock = await GetStockByProductAsync(products.Select(x => x.Id).ToList());

        return products
            .Select(x => new StockOverviewDto(
                x.Id,
                x.Name,
                stock.GetValueOrDefault(x.Id),
                x.LowStockThreshold,
                "Stück",
                x.PurchasePrice,
                x.InternalSellingPrice,
                x.ExternalSellingPrice
            ))
            .ToList();
    }

    private async Task<Dictionary<Guid, int>> GetStockByProductAsync(IList<Guid> productIds)
    {
        var snapshot = await db.InventoryTransactions
            .Where(x => x.IsActive && productIds.Contains(x.ProductId))
            .GroupBy(x => x.ProductId)
            .Select(x => new
            {
                ProductId = x.Key,
                Stock = x.Sum(q => q.Quantity),
            })
            .ToListAsync();

        return snapshot.ToDictionary(x => x.ProductId, x => x.Stock);
    }
}

public record StockOverviewDto(Guid ProductId, string Name, int Stock, int Threshold, string Unit, decimal PurchasePrice, decimal SellingPriceInternal, decimal SellingPriceExternal);
public record StockUpdatePositionDto(Guid ProductId, int NewStock, InventoryTransactionType Type, string? Note);
public record StockUpdateRequest(string? Note, IList<StockUpdatePositionDto> Positions);
