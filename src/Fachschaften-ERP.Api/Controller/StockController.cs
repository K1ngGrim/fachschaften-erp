using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/stock")]
public class StockController(
    CoreContext db,
    IConfiguration configuration
    ): ControllerBase
{
    /// <summary>Längster abfragbarer Zeitraum für den Bestandsverlauf, in Tagen.</summary>
    private const int MaxHistoryDays = 3 * 366;

    [RequirePermission(PermissionType.InventoryRead)]
    [HttpGet]
    public async Task<ActionResult<IList<StockOverviewDto>>> GetAll()
    {
        return Ok(await GetOverviewAsync());
    }

    /// <summary>
    /// Bestandsverlauf eines Artikels: Bestand am Ende jedes Tages im Zeitraum, berechnet aus den
    /// Lagerbewegungen. Tage zählen in der Zeitzone der Fachschaft; <paramref name="to"/> ist inklusive.
    /// </summary>
    [RequirePermission(PermissionType.InventoryRead)]
    [HttpGet("{productId:guid}/history")]
    public async Task<ActionResult<StockHistoryDto>> History(Guid productId, [FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (to < from) return BadRequest("'to' must not be before 'from'.");
        if (to.DayNumber - from.DayNumber >= MaxHistoryDays) return BadRequest($"The range may span at most {MaxHistoryDays} days.");

        var exists = await db.Products.AnyAsync(x => x.IsActive && x.Id == productId);
        if (!exists) return NotFound();

        var zone = AppTimeZone.From(configuration);
        var start = StartOfDay(from, zone);
        var end = StartOfDay(to.AddDays(1), zone);

        var transactions = db.InventoryTransactions
            .Where(x => x.IsActive && x.ProductId == productId);

        var openingStock = await transactions
            .Where(x => x.Created < start)
            .SumAsync(x => x.Quantity);

        var movements = await transactions
            .Where(x => x.Created >= start && x.Created < end)
            .Select(x => new { x.Created, x.Quantity })
            .ToListAsync();

        var changeByDay = movements
            .GroupBy(x => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.Created, zone).DateTime))
            .ToDictionary(g => g.Key, g => (
                Incoming: g.Where(x => x.Quantity > 0).Sum(x => x.Quantity),
                Outgoing: g.Where(x => x.Quantity < 0).Sum(x => -x.Quantity)));

        var points = new List<StockHistoryPointDto>();
        var stock = openingStock;
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var (incoming, outgoing) = changeByDay.GetValueOrDefault(day);
            stock += incoming - outgoing;
            points.Add(new StockHistoryPointDto(day, stock, incoming, outgoing));
        }

        return Ok(new StockHistoryDto(
            productId,
            from,
            to,
            openingStock,
            stock,
            points.Sum(x => x.Incoming),
            points.Sum(x => x.Outgoing),
            points));
    }

    private static DateTimeOffset StartOfDay(DateOnly day, TimeZoneInfo zone)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone), TimeSpan.Zero);
    }

    [RequirePermission(PermissionType.InventoryWrite)]
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
                UnitPurchasePrice = product.PerStockUnit(product.PurchasePrice),
                UnitSellingPrice = product.PerStockUnit(product.InternalSellingPrice),
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
                x.Unit ?? ProductBase.DefaultUnit,
                x.PurchasePrice,
                x.InternalSellingPrice,
                x.ExternalSellingPrice,
                x.TrackStock,
                x.PriceUnit ?? x.Unit ?? ProductBase.DefaultUnit,
                x.PriceUnitsPerStockUnit,
                x.StockValue(stock.GetValueOrDefault(x.Id))
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

/// <param name="Stock">Bestand in <paramref name="Unit"/>.</param>
/// <param name="PurchasePrice">Einkaufspreis pro <paramref name="PriceUnit"/>; ebenso die Verkaufspreise.</param>
/// <param name="PriceUnitsPerStockUnit">Preiseinheiten pro Bestandseinheit, z. B. 20 Flaschen pro Kiste.</param>
/// <param name="StockValue">Warenwert des Bestands zum Einkaufspreis.</param>
public record StockOverviewDto(Guid ProductId, string Name, int Stock, int Threshold, string Unit, decimal PurchasePrice, decimal SellingPriceInternal, decimal SellingPriceExternal, bool TrackStock, string PriceUnit, decimal PriceUnitsPerStockUnit, decimal StockValue);
/// <param name="Stock">Bestand am Ende des Tages.</param>
/// <param name="Incoming">Summe der Zugänge an diesem Tag.</param>
/// <param name="Outgoing">Summe der Abgänge an diesem Tag, als positive Zahl.</param>
public record StockHistoryPointDto(DateOnly Date, int Stock, int Incoming, int Outgoing);

/// <param name="OpeningStock">Bestand zu Beginn von <paramref name="From"/>.</param>
/// <param name="ClosingStock">Bestand am Ende von <paramref name="To"/>.</param>
/// <param name="Points">Ein Eintrag pro Tag von <paramref name="From"/> bis <paramref name="To"/>.</param>
public record StockHistoryDto(Guid ProductId, DateOnly From, DateOnly To, int OpeningStock, int ClosingStock, int Incoming, int Outgoing, IList<StockHistoryPointDto> Points);
public record StockUpdatePositionDto(Guid ProductId, int NewStock, InventoryTransactionType Type, string? Note);
public record StockUpdateRequest(string? Note, IList<StockUpdatePositionDto> Positions);
