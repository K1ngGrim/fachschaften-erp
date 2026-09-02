using System.Linq.Expressions;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/bookings")]
public class BookingsController(CoreContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IList<BookingDto>>> GetAll(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] TaxArea? taxArea,
        [FromQuery] Guid? cashBookId,
        [FromQuery] CashIncomeSource? source)
    {
        var bookings = await db.Bookings
            .Where(x => x.IsActive)
            .Where(x => year == null || x.Date.Year == year)
            .Where(x => month == null || x.Date.Month == month)
            .Where(x => taxArea == null || x.TaxArea == taxArea)
            .Where(x => cashBookId == null || x.CashBookId == cashBookId)
            .Where(x => source == null || x.Source == source)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.Created)
            .Select(Projection)
            .ToListAsync();

        return Ok(bookings);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingDto>> Get(Guid id)
    {
        var booking = await db.Bookings
            .Where(x => x.Id == id && x.IsActive)
            .Select(Projection)
            .FirstOrDefaultAsync();

        return booking is null ? NotFound() : Ok(booking);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<BookingSummaryDto>> Summary([FromQuery] int? year)
    {
        var targetYear = year ?? DateTimeOffset.UtcNow.Year;

        var bookings = await db.Bookings
            .Where(x => x.IsActive && x.TransferGroupId == null && x.Date.Year == targetYear)
            .Select(x => new { x.Date.Month, x.Amount, x.TaxArea })
            .ToListAsync();

        var byTaxArea = Enum.GetValues<TaxArea>()
            .Select(area =>
            {
                var entries = bookings.Where(x => x.TaxArea == area).ToList();
                var income = entries.Where(x => x.Amount > 0).Sum(x => x.Amount);
                var expense = entries.Where(x => x.Amount < 0).Sum(x => -x.Amount);
                return new TaxAreaSummaryDto(area, income, expense, income - expense);
            })
            .ToList();

        var byMonth = Enumerable.Range(1, 12)
            .Select(month =>
            {
                var entries = bookings.Where(x => x.Month == month).ToList();
                return new MonthSummaryDto(
                    month,
                    entries.Where(x => x.Amount > 0).Sum(x => x.Amount),
                    entries.Where(x => x.Amount < 0).Sum(x => -x.Amount));
            })
            .ToList();

        var totalIncome = bookings.Where(x => x.Amount > 0).Sum(x => x.Amount);
        var totalExpense = bookings.Where(x => x.Amount < 0).Sum(x => -x.Amount);

        return Ok(new BookingSummaryDto(
            targetYear,
            totalIncome,
            totalExpense,
            totalIncome - totalExpense,
            byTaxArea,
            byMonth));
    }

    [HttpPost]
    public async Task<ActionResult<BookingDto>> Upsert(ItemUpsertRequest<BookingDto> request)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        BookingEntity? existing = null;

        if (request.Id is not null)
        {
            existing = await db.Bookings.FirstOrDefaultAsync(x => x.Id == request.Id && x.IsActive);
            if (existing is null) return NotFound();
            if (existing.TransferGroupId is not null)
                return BadRequest("Transfers between cash books cannot be edited.");
        }

        var validation = await ValidateAsync(request.Value);
        if (validation is not null) return BadRequest(validation);

        BookingEntity entity;

        if (existing is null)
        {
            entity = new BookingEntity
            {
                Id = Guid.NewGuid(),
                Created = now,
                CreatorId = invoker.UserId,
                IsActive = true,
            };
            db.Bookings.Add(entity);
        }
        else
        {
            entity = existing;
            entity.Modified = now;
            entity.ModifierId = invoker.UserId;
        }

        entity.Date = request.Value.Date;
        entity.Amount = request.Value.Amount;
        entity.Description = request.Value.Description;
        entity.TaxArea = request.Value.TaxArea;
        entity.CategoryId = request.Value.CategoryId;
        entity.CashBookId = request.Value.CashBookId;
        entity.ReceiptUrl = request.Value.ReceiptUrl;
        entity.Source = request.Value.Source;

        await db.SaveChangesAsync();

        var saved = await db.Bookings
            .Where(x => x.Id == entity.Id)
            .Select(Projection)
            .FirstAsync();

        return request.Id is null
            ? CreatedAtAction(nameof(Get), new { id = saved.Id }, saved)
            : Ok(saved);
    }

    [HttpPost("cash-income")]
    public async Task<ActionResult<IList<BookingDto>>> CashIncome(CashIncomeRequest request)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        if (request.CashAmount < 0 || request.TallyListAmount < 0 || request.SumUpAmount < 0)
            return BadRequest("Amounts must not be negative.");

        if (request.CashAmount == 0 && request.TallyListAmount == 0 && request.SumUpAmount == 0)
            return BadRequest("At least one amount is required.");

        if (request.CashAmount > 0 && request.CashBookId is null)
            return BadRequest("Cash income needs a cash book.");

        if (request.CashBookId is { } cashBookId)
        {
            var cashBook = await db.CashBooks.FirstOrDefaultAsync(x => x.Id == cashBookId && x.IsActive);
            if (cashBook is null) return BadRequest("Invalid CashBookId.");
            if (cashBook.IsClosed) return BadRequest("The cash book is closed.");
        }

        if (request.CategoryId is { } categoryId)
        {
            var categoryExists = await db.BookingCategories
                .AnyAsync(x => x.Id == categoryId && x.IsActive && x.TaxArea == request.TaxArea);

            if (!categoryExists) return BadRequest("Invalid CategoryId for the given tax area.");
        }

        var label = request.Description?.Trim();
        if (string.IsNullOrEmpty(label)) label = "Kasseneinnahmen " + request.Date.ToString("dd.MM.yyyy");

        var sources = new (CashIncomeSource Source, decimal Amount, string Label, Guid? CashBookId)[]
        {
            (CashIncomeSource.Cash, request.CashAmount, "Bar", request.CashBookId),
            (CashIncomeSource.TallyList, request.TallyListAmount, "Strichliste", null),
            (CashIncomeSource.SumUp, request.SumUpAmount, "SumUp", null),
        };

        var created = new List<Guid>();

        foreach (var entry in sources)
        {
            if (entry.Amount <= 0) continue;

            var booking = new BookingEntity
            {
                Id = Guid.NewGuid(),
                Date = request.Date,
                Amount = entry.Amount,
                Description = label + " – " + entry.Label,
                TaxArea = request.TaxArea,
                CategoryId = request.CategoryId,
                CashBookId = entry.CashBookId,
                Source = entry.Source,
                CreatorId = invoker.UserId,
                Created = now,
                IsActive = true,
            };

            db.Bookings.Add(booking);
            created.Add(booking.Id);
        }

        await db.SaveChangesAsync();

        var bookings = await db.Bookings
            .Where(x => created.Contains(x.Id))
            .Select(Projection)
            .ToListAsync();

        return Ok(bookings);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.Bookings.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        var now = DateTimeOffset.UtcNow;

        if (entity.TransferGroupId is { } transferGroupId)
        {
            var counterparts = await db.Bookings
                .Where(x => x.IsActive && x.TransferGroupId == transferGroupId)
                .ToListAsync();

            foreach (var counterpart in counterparts)
            {
                counterpart.IsActive = false;
                counterpart.Modified = now;
                counterpart.ModifierId = invoker.UserId;
            }
        }
        else
        {
            entity.IsActive = false;
            entity.Modified = now;
            entity.ModifierId = invoker.UserId;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> ValidateAsync(BookingDto value)
    {
        if (value.Amount == 0) return "The amount must not be zero.";
        if (string.IsNullOrWhiteSpace(value.Description)) return "Description is required.";
        if (value.TaxArea is null) return "TaxArea is required.";

        if (value.CategoryId is { } categoryId)
        {
            var category = await db.BookingCategories
                .FirstOrDefaultAsync(x => x.Id == categoryId && x.IsActive);

            if (category is null) return "Invalid CategoryId.";
            if (category.TaxArea != value.TaxArea) return "The category belongs to a different tax area.";
        }

        if (value.CashBookId is { } cashBookId)
        {
            var cashBook = await db.CashBooks
                .FirstOrDefaultAsync(x => x.Id == cashBookId && x.IsActive);

            if (cashBook is null) return "Invalid CashBookId.";
            if (cashBook.IsClosed) return "The cash book is closed.";
        }

        return null;
    }

    private static readonly Expression<Func<BookingEntity, BookingDto>> Projection = entity => new BookingDto
    {
        Id = entity.Id,
        Date = entity.Date,
        Amount = entity.Amount,
        Description = entity.Description,
        TaxArea = entity.TaxArea,
        CategoryId = entity.CategoryId,
        CategoryName = entity.Category != null ? entity.Category.Name : null,
        CashBookId = entity.CashBookId,
        CashBookName = entity.CashBook != null ? entity.CashBook.Name : null,
        ReceiptUrl = entity.ReceiptUrl,
        Source = entity.Source,
        TransferGroupId = entity.TransferGroupId,
    };
}

public class BookingDto : BookingBase
{
    public string? CategoryName { get; set; }
    public string? CashBookName { get; set; }
}

public record CashIncomeRequest(
    DateTimeOffset Date,
    decimal CashAmount,
    decimal TallyListAmount,
    decimal SumUpAmount,
    TaxArea TaxArea,
    Guid? CashBookId,
    Guid? CategoryId,
    string? Description);

public record TaxAreaSummaryDto(TaxArea TaxArea, decimal Income, decimal Expense, decimal Balance);

public record MonthSummaryDto(int Month, decimal Income, decimal Expense);

public record BookingSummaryDto(
    int Year,
    decimal Income,
    decimal Expense,
    decimal Balance,
    IList<TaxAreaSummaryDto> ByTaxArea,
    IList<MonthSummaryDto> ByMonth);
