using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/reports")]
public class ReportsController(CoreContext db) : ControllerBase
{
    /// <summary>
    /// Jahresabschluss für die Kassenprüfung. Umbuchungen zwischen Kassen zählen nicht als
    /// Einnahme oder Ausgabe, wohl aber in den Kassenbeständen.
    /// </summary>
    [RequirePermission(PermissionType.FinanceRead)]
    [HttpGet("annual")]
    public async Task<ActionResult<AnnualReportDto>> Annual([FromQuery] int year)
    {
        if (year is < 2000 or > 2100) return BadRequest("Invalid year.");

        var start = new DateTimeOffset(year, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var end = start.AddYears(1);

        var bookings = await db.Bookings
            .Where(b => b.IsActive && b.Date >= start && b.Date < end)
            .Select(b => new
            {
                b.Amount,
                b.TaxArea,
                CategoryName = b.Category != null ? b.Category.Name : null,
                b.CashBookId,
                IsTransfer = b.TransferGroupId != null,
            })
            .ToListAsync();

        var operational = bookings.Where(b => !b.IsTransfer).ToList();

        var taxAreas = Enum.GetValues<TaxArea>()
            .Select(area =>
            {
                var entries = operational.Where(b => b.TaxArea == area).ToList();
                var income = entries.Where(b => b.Amount > 0).Sum(b => b.Amount);
                var expense = entries.Where(b => b.Amount < 0).Sum(b => -b.Amount);
                return new TaxAreaSummaryDto(area, income, expense, income - expense);
            })
            .ToList();

        var categories = operational
            .GroupBy(b => new { b.TaxArea, b.CategoryName })
            .Select(g => new CategorySummaryDto(
                g.Key.TaxArea,
                g.Key.CategoryName,
                g.Where(b => b.Amount > 0).Sum(b => b.Amount),
                g.Where(b => b.Amount < 0).Sum(b => -b.Amount)))
            .OrderBy(c => c.TaxArea)
            .ThenBy(c => c.CategoryName ?? "￿")
            .ToList();

        var openingBalances = await db.Bookings
            .Where(b => b.IsActive && b.CashBookId != null && b.Date < start)
            .GroupBy(b => b.CashBookId!.Value)
            .Select(g => new { CashBookId = g.Key, Balance = g.Sum(b => b.Amount) })
            .ToDictionaryAsync(x => x.CashBookId, x => x.Balance);

        var cashBooks = (await db.CashBooks
                .Where(c => c.IsActive)
                .OrderBy(c => c.ParentId == null ? 0 : 1)
                .ThenBy(c => c.Name)
                .Select(c => new { c.Id, c.Name, c.IsClosed })
                .ToListAsync())
            .Select(c =>
            {
                var entries = bookings.Where(b => b.CashBookId == c.Id).ToList();
                var opening = openingBalances.GetValueOrDefault(c.Id);
                var inflow = entries.Where(b => b.Amount > 0).Sum(b => b.Amount);
                var outflow = entries.Where(b => b.Amount < 0).Sum(b => -b.Amount);
                return new CashBookSummaryDto(c.Id, c.Name, c.IsClosed, opening, inflow, outflow, opening + inflow - outflow);
            })
            // Kassen ohne Bestand und ohne Bewegung im Jahr weglassen.
            .Where(c => c.Opening != 0 || c.Inflow != 0 || c.Outflow != 0)
            .ToList();

        var totalIncome = taxAreas.Sum(t => t.Income);
        var totalExpense = taxAreas.Sum(t => t.Expense);

        return Ok(new AnnualReportDto(
            year,
            totalIncome,
            totalExpense,
            totalIncome - totalExpense,
            bookings.Count,
            bookings.Count(b => b.IsTransfer),
            taxAreas,
            categories,
            cashBooks));
    }
}

/// <param name="CategoryName">null = ohne Kategorie.</param>
public record CategorySummaryDto(TaxArea? TaxArea, string? CategoryName, decimal Income, decimal Expense);

public record CashBookSummaryDto(
    Guid Id,
    string Name,
    bool IsClosed,
    decimal Opening,
    decimal Inflow,
    decimal Outflow,
    decimal Closing);

public record AnnualReportDto(
    int Year,
    decimal Income,
    decimal Expense,
    decimal Balance,
    int BookingCount,
    int TransferCount,
    IList<TaxAreaSummaryDto> TaxAreas,
    IList<CategorySummaryDto> Categories,
    IList<CashBookSummaryDto> CashBooks);
