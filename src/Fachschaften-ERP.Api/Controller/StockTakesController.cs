using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/stock-takes")]
public class StockTakesController(CoreContext db) : ControllerBase
{
    [RequirePermission(PermissionType.InventoryRead)]
    [HttpGet]
    public async Task<ActionResult<IList<StockTakeSummaryDto>>> GetAll()
    {
        var stockTakes = await db.StockTakes
            .Where(s => s.IsActive)
            .OrderByDescending(s => s.Created)
            .Select(s => new
            {
                s.Id,
                s.Created,
                s.CreatorId,
                s.Note,
                PositionCount = s.Positions.Count,
                DifferenceCount = s.Positions.Count(p => p.CountedStock != p.ExpectedStock),
                DifferenceValue = s.Positions.Sum(p => (p.CountedStock - p.ExpectedStock) * p.UnitPurchasePrice),
            })
            .ToListAsync();

        var names = await UserNamesAsync(stockTakes.Select(s => s.CreatorId));
        return Ok(stockTakes
            .Select(s => new StockTakeSummaryDto(s.Id, s.Created, names.GetValueOrDefault(s.CreatorId), s.Note,
                s.PositionCount, s.DifferenceCount, s.DifferenceValue))
            .ToList());
    }

    [RequirePermission(PermissionType.InventoryRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StockTakeDto>> Get(Guid id)
    {
        var dto = await LoadAsync(id);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>
    /// Bucht eine Inventur. Das Soll wird erst jetzt ermittelt, damit Verkäufe während des
    /// Zählens nicht als Differenz erscheinen. Nur gezählte Artikel werden übergeben.
    /// </summary>
    [RequirePermission(PermissionType.InventoryWrite)]
    [HttpPost]
    public async Task<ActionResult<StockTakeDto>> Create(CreateStockTakeRequest request)
    {
        if (request.Positions is not { Count: > 0 }) return BadRequest("At least one counted product is required.");
        if (request.Positions.Any(p => p.CountedStock < 0)) return BadRequest("Counted stock cannot be negative.");
        if (request.Note?.Trim().Length > 500) return BadRequest("Note is too long.");

        var productIds = request.Positions.Select(p => p.ProductId).ToList();
        if (productIds.Distinct().Count() != productIds.Count) return BadRequest("Each product may only be counted once.");

        var products = await db.Products
            .Where(p => p.IsActive && p.TrackStock && productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);
        if (products.Count != productIds.Count) return BadRequest("Unknown products or products without stock tracking.");

        var stock = await db.InventoryTransactions
            .Where(t => t.IsActive && productIds.Contains(t.ProductId))
            .GroupBy(t => t.ProductId)
            .Select(g => new { ProductId = g.Key, Stock = g.Sum(t => t.Quantity) })
            .ToDictionaryAsync(x => x.ProductId, x => x.Stock);

        var userId = ((Invoker)User).UserId;
        var now = DateTimeOffset.UtcNow;
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var movementNote = note is null ? "Inventur" : $"Inventur: {note}";
        if (movementNote.Length > 255) movementNote = movementNote[..255];
        var stockTake = new StockTakeEntity
        {
            Id = Guid.NewGuid(),
            Note = note,
            CreatorId = userId,
            Created = now,
            IsActive = true,
        };

        foreach (var position in request.Positions)
        {
            var product = products[position.ProductId];
            var expected = stock.GetValueOrDefault(product.Id);

            stockTake.Positions.Add(new StockTakePositionEntity
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                ExpectedStock = expected,
                CountedStock = position.CountedStock,
                UnitPurchasePrice = product.PurchasePrice,
            });

            var difference = position.CountedStock - expected;
            if (difference == 0) continue;

            db.InventoryTransactions.Add(new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Quantity = difference,
                UnitPurchasePrice = product.PurchasePrice,
                UnitSellingPrice = product.InternalSellingPrice,
                Type = InventoryTransactionType.StockTake,
                ReferenceId = stockTake.Id,
                Note = movementNote,
                CreatorId = userId,
                Created = now,
                IsActive = true,
            });
        }

        db.StockTakes.Add(stockTake);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = stockTake.Id }, await LoadAsync(stockTake.Id));
    }

    private async Task<StockTakeDto?> LoadAsync(Guid id)
    {
        var stockTake = await db.StockTakes
            .AsNoTracking()
            .Include(s => s.Positions)
            .ThenInclude(p => p.Product)
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive);
        if (stockTake is null) return null;

        var names = await UserNamesAsync([stockTake.CreatorId]);
        return new StockTakeDto(
            stockTake.Id,
            stockTake.Created,
            names.GetValueOrDefault(stockTake.CreatorId),
            stockTake.Note,
            stockTake.Positions
                .OrderBy(p => p.Product?.Name)
                .Select(p => new StockTakePositionDto(
                    p.ProductId,
                    p.Product?.Name ?? string.Empty,
                    p.ExpectedStock,
                    p.CountedStock,
                    p.CountedStock - p.ExpectedStock,
                    p.UnitPurchasePrice,
                    (p.CountedStock - p.ExpectedStock) * p.UnitPurchasePrice))
                .ToList());
    }

    private async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return await db.Users
            .Where(u => distinct.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.UserName ?? string.Empty);
    }
}

public record StockTakeSummaryDto(
    Guid Id,
    DateTimeOffset Date,
    string? CreatedBy,
    string? Note,
    int PositionCount,
    int DifferenceCount,
    decimal DifferenceValue);

public record StockTakePositionDto(
    Guid ProductId,
    string ProductName,
    int ExpectedStock,
    int CountedStock,
    int Difference,
    decimal UnitPurchasePrice,
    decimal DifferenceValue);

public record StockTakeDto(
    Guid Id,
    DateTimeOffset Date,
    string? CreatedBy,
    string? Note,
    IList<StockTakePositionDto> Positions);

public record CountedStockDto(Guid ProductId, int CountedStock);

/// <param name="Positions">Nur die gezählten Artikel.</param>
public record CreateStockTakeRequest(string? Note, IList<CountedStockDto> Positions);
