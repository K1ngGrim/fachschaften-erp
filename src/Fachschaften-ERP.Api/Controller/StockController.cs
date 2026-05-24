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
        var transactionSnapshot = await db.InventoryTransactions
            .Where(x => x.IsActive)
            .GroupBy(x => x.ProductId)
            .Select(x => new
            {
                ProductId = x.Key,
                Stock = x.Sum(q => q.Quantity),

            })
            .ToListAsync();
        
        var products = await db.Products
            .Where(x => x.IsActive)
            .ToListAsync();

        var entries = products
            .Select(x => new StockOverviewDto(
                x.Id,
                x.Name,
                transactionSnapshot.Where(t => t.ProductId == x.Id).Select(t => t.Stock).FirstOrDefault(),
                x.LowStockThreshold,
                "Stück",
                x.PurchasePrice,
                x.InternalSellingPrice,
                x.ExternalSellingPrice
            ))
            .ToList();
        
        return Ok(entries);
    }
    
    
    
}

public record StockOverviewDto(Guid ProductId, string Name, int Stock, int Threshold, string Unit, decimal PurchasePrice, decimal SellingPriceInternal, decimal SellingPriceExternal);