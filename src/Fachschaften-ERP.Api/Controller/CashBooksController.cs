using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/cash-books")]
public class CashBooksController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<CashBookDto>>> GetAll()
    {
        return Ok(await GetOverviewAsync());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CashBookDto>> Get(Guid id)
    {
        var book = (await GetOverviewAsync()).FirstOrDefault(x => x.Id == id);
        return book is null ? NotFound() : Ok(book);
    }

    [HttpPost]
    public async Task<ActionResult<CashBookDto>> Upsert(ItemUpsertRequest<CashBookUpsertDto> request)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        if (string.IsNullOrWhiteSpace(request.Value.Name))
            return BadRequest("Name is required.");

        if (request.Value.ParentId is { } parentId)
        {
            if (parentId == request.Id)
                return BadRequest("A cash book cannot be its own parent.");

            var parent = await db.CashBooks.FirstOrDefaultAsync(x => x.Id == parentId && x.IsActive);
            if (parent is null) return BadRequest("Invalid ParentId.");
            if (parent.IsClosed) return BadRequest("The parent cash book is closed.");
            if (parent.ParentId is not null)
                return BadRequest("Only one level below the main cash book is supported.");
        }

        CashBookEntity entity;

        if (request.Id is null)
        {
            entity = new CashBookEntity
            {
                Id = Guid.NewGuid(),
                Created = now,
                CreatorId = invoker.UserId,
                IsActive = true,
            };
            db.CashBooks.Add(entity);
        }
        else
        {
            var existing = await db.CashBooks.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (existing is null) return NotFound();
            if (existing.IsClosed) return BadRequest("A closed cash book cannot be changed.");

            var hasChildren = await db.CashBooks.AnyAsync(x => x.IsActive && x.ParentId == existing.Id);
            if (hasChildren && request.Value.ParentId is not null)
                return BadRequest("A cash book with sub cash books cannot become a sub cash book itself.");

            entity = existing;
            entity.Modified = now;
            entity.ModifierId = invoker.UserId;
        }

        entity.Name = request.Value.Name;
        entity.ParentId = request.Value.ParentId;

        await db.SaveChangesAsync();

        if (request.Id is null && request.Value.OpeningAmount > 0 && entity.ParentId is { } source)
        {
            var error = await TransferAsync(
                source,
                entity.Id,
                request.Value.OpeningAmount,
                now,
                "Wechselgeld für " + entity.Name,
                invoker.UserId);

            if (error is not null) return BadRequest(error);
            await db.SaveChangesAsync();
        }

        var saved = (await GetOverviewAsync()).First(x => x.Id == entity.Id);

        return request.Id is null
            ? CreatedAtAction(nameof(Get), new { id = saved.Id }, saved)
            : Ok(saved);
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer(CashBookTransferRequest request)
    {
        var invoker = (Invoker)User;

        var error = await TransferAsync(
            request.FromCashBookId,
            request.ToCashBookId,
            request.Amount,
            request.Date,
            request.Description,
            invoker.UserId);

        if (error is not null) return BadRequest(error);

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        var entity = await db.CashBooks.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();
        if (entity.IsClosed) return BadRequest("The cash book is already closed.");

        var hasOpenChildren = await db.CashBooks.AnyAsync(x => x.IsActive && !x.IsClosed && x.ParentId == id);
        if (hasOpenChildren) return BadRequest("Close the sub cash books first.");

        var balance = await GetBalanceAsync(id);

        if (balance != 0)
        {
            if (entity.ParentId is not { } parentId)
                return BadRequest("The main cash book can only be closed with a balance of zero.");

            var error = await TransferAsync(
                id,
                parentId,
                balance,
                now,
                "Restbestand aus " + entity.Name,
                invoker.UserId);

            if (error is not null) return BadRequest(error);
        }

        entity.IsClosed = true;
        entity.ClosedAt = now;
        entity.Modified = now;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.CashBooks.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        var hasBookings = await db.Bookings.AnyAsync(x => x.IsActive && x.CashBookId == id);
        if (hasBookings) return BadRequest("Cash books with bookings cannot be deleted, close them instead.");

        var hasChildren = await db.CashBooks.AnyAsync(x => x.IsActive && x.ParentId == id);
        if (hasChildren) return BadRequest("Remove the sub cash books first.");

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> TransferAsync(
        Guid fromId,
        Guid toId,
        decimal amount,
        DateTimeOffset date,
        string description,
        Guid userId)
    {
        if (fromId == toId) return "Source and target cash book must differ.";
        if (amount <= 0) return "The amount must be greater than zero.";

        var books = await db.CashBooks
            .Where(x => x.IsActive && (x.Id == fromId || x.Id == toId))
            .ToListAsync();

        var from = books.FirstOrDefault(x => x.Id == fromId);
        var to = books.FirstOrDefault(x => x.Id == toId);

        if (from is null || to is null) return "Invalid cash book.";
        if (from.IsClosed && to.IsClosed) return "Both cash books are closed.";

        var transferGroupId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        db.Bookings.AddRange(
            new BookingEntity
            {
                Id = Guid.NewGuid(),
                CashBookId = fromId,
                Date = date,
                Amount = -amount,
                Description = description,
                TransferGroupId = transferGroupId,
                CreatorId = userId,
                Created = now,
                IsActive = true,
            },
            new BookingEntity
            {
                Id = Guid.NewGuid(),
                CashBookId = toId,
                Date = date,
                Amount = amount,
                Description = description,
                TransferGroupId = transferGroupId,
                CreatorId = userId,
                Created = now,
                IsActive = true,
            });

        return null;
    }

    private async Task<decimal> GetBalanceAsync(Guid cashBookId)
    {
        return await db.Bookings
            .Where(x => x.IsActive && x.CashBookId == cashBookId)
            .SumAsync(x => (decimal?)x.Amount) ?? 0m;
    }

    private async Task<IList<CashBookDto>> GetOverviewAsync()
    {
        var books = await db.CashBooks
            .Where(x => x.IsActive)
            .OrderBy(x => x.ParentId == null ? 0 : 1)
            .ThenBy(x => x.Name)
            .ToListAsync();

        var balances = await db.Bookings
            .Where(x => x.IsActive && x.CashBookId != null)
            .GroupBy(x => x.CashBookId!.Value)
            .Select(x => new { CashBookId = x.Key, Balance = x.Sum(b => b.Amount) })
            .ToListAsync();

        var byId = books.ToDictionary(x => x.Id);

        return books
            .Select(x => new CashBookDto
            {
                Id = x.Id,
                Name = x.Name,
                ParentId = x.ParentId,
                ParentName = x.ParentId is { } parentId && byId.TryGetValue(parentId, out var parent)
                    ? parent.Name
                    : null,
                IsClosed = x.IsClosed,
                ClosedAt = x.ClosedAt,
                Balance = balances.FirstOrDefault(b => b.CashBookId == x.Id)?.Balance ?? 0m,
            })
            .ToList();
    }
}

public class CashBookDto : CashBookBase
{
    public string? ParentName { get; set; }
    public bool IsClosed { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public decimal Balance { get; set; }
}

public class CashBookUpsertDto : CashBookBase
{
    /// <summary>Wird beim Anlegen einer Unterkasse aus der übergeordneten Kasse übertragen.</summary>
    public decimal OpeningAmount { get; set; }
}

public record CashBookTransferRequest(
    Guid FromCashBookId,
    Guid ToCashBookId,
    decimal Amount,
    DateTimeOffset Date,
    string Description);
