using System.Linq.Expressions;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/bookings")]
public class BookingsController(CoreContext db) : ControllerBase
{
    [RequirePermission(PermissionType.FinanceRead)]
    [HttpGet]
    public async Task<ActionResult<IList<BookingDto>>> GetAll(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] TaxArea? taxArea,
        [FromQuery] Guid? cashBookId)
    {
        var bookings = await db.Bookings
            .Where(x => x.IsActive)
            .Where(x => year == null || x.Date.Year == year)
            .Where(x => month == null || x.Date.Month == month)
            .Where(x => taxArea == null || x.TaxArea == taxArea)
            .Where(x => cashBookId == null || x.CashBookId == cashBookId)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.Created)
            .Select(Projection)
            .ToListAsync();

        return Ok(bookings);
    }

    [RequirePermission(PermissionType.FinanceRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingDto>> Get(Guid id)
    {
        var booking = await db.Bookings
            .Where(x => x.Id == id && x.IsActive)
            .Select(Projection)
            .FirstOrDefaultAsync();

        return booking is null ? NotFound() : Ok(booking);
    }

    [RequirePermission(PermissionType.FinanceRead)]
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

    [RequirePermission(PermissionType.FinanceWrite)]
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

        await db.SaveChangesAsync();

        var saved = await db.Bookings
            .Where(x => x.Id == entity.Id)
            .Select(Projection)
            .FirstAsync();

        return request.Id is null
            ? CreatedAtAction(nameof(Get), new { id = saved.Id }, saved)
            : Ok(saved);
    }

    [RequirePermission(PermissionType.FinanceWrite)]
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
        TransferGroupId = entity.TransferGroupId,
    };
}

public class BookingDto : BookingBase
{
    public string? CategoryName { get; set; }
    public string? CashBookName { get; set; }
}

public record TaxAreaSummaryDto(TaxArea TaxArea, decimal Income, decimal Expense, decimal Balance);

public record MonthSummaryDto(int Month, decimal Income, decimal Expense);

public record BookingSummaryDto(
    int Year,
    decimal Income,
    decimal Expense,
    decimal Balance,
    IList<TaxAreaSummaryDto> ByTaxArea,
    IList<MonthSummaryDto> ByMonth);
