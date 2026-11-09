using System.Linq.Expressions;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Einnahmen der Getränkekasse. Sie werden getrennt von den Buchungen geführt und tauchen
/// weder in den Finanzen noch in Kassenbüchern oder im Jahresabschluss auf.
/// </summary>
[ApiController]
[Route("/api/cash-income")]
public class CashIncomeController(CoreContext db) : ControllerBase
{
    [RequirePermission(PermissionType.FinanceRead)]
    [HttpGet]
    public async Task<ActionResult<IList<CashIncomeDto>>> GetAll(
        [FromQuery] int? year,
        [FromQuery] CashIncomeSource? source)
    {
        var entries = await db.CashIncomes
            .Where(x => x.IsActive)
            .Where(x => year == null || x.Date.Year == year)
            .Where(x => source == null || x.Source == source)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.Created)
            .Select(Projection)
            .ToListAsync();

        return Ok(entries);
    }

    [RequirePermission(PermissionType.FinanceWrite)]
    [HttpPost]
    public async Task<ActionResult<IList<CashIncomeDto>>> Create(CashIncomeRequest request)
    {
        var invoker = (Invoker)User;
        var now = DateTimeOffset.UtcNow;

        if (request.CashAmount < 0 || request.TallyListAmount < 0 || request.SumUpAmount < 0)
            return BadRequest("Amounts must not be negative.");

        if (request.CashAmount == 0 && request.TallyListAmount == 0 && request.SumUpAmount == 0)
            return BadRequest("At least one amount is required.");

        var label = request.Description?.Trim();
        if (string.IsNullOrEmpty(label)) label = "Kasseneinnahmen " + request.Date.ToString("dd.MM.yyyy");

        var sources = new (CashIncomeSource Source, decimal Amount, string Label)[]
        {
            (CashIncomeSource.Cash, request.CashAmount, "Bar"),
            (CashIncomeSource.TallyList, request.TallyListAmount, "Strichliste"),
            (CashIncomeSource.SumUp, request.SumUpAmount, "SumUp"),
        };

        var created = new List<Guid>();

        foreach (var entry in sources)
        {
            if (entry.Amount <= 0) continue;

            var income = new CashIncomeEntity
            {
                Id = Guid.NewGuid(),
                Date = request.Date,
                Amount = entry.Amount,
                Source = entry.Source,
                Description = label + " – " + entry.Label,
                CreatorId = invoker.UserId,
                Created = now,
                IsActive = true,
            };

            db.CashIncomes.Add(income);
            created.Add(income.Id);
        }

        await db.SaveChangesAsync();

        var entries = await db.CashIncomes
            .Where(x => created.Contains(x.Id))
            .Select(Projection)
            .ToListAsync();

        return Ok(entries);
    }

    [RequirePermission(PermissionType.FinanceWrite)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var invoker = (Invoker)User;

        var entity = await db.CashIncomes.FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
        if (entity is null) return NotFound();

        entity.IsActive = false;
        entity.Modified = DateTimeOffset.UtcNow;
        entity.ModifierId = invoker.UserId;

        await db.SaveChangesAsync();
        return NoContent();
    }

    private static readonly Expression<Func<CashIncomeEntity, CashIncomeDto>> Projection = entity => new CashIncomeDto
    {
        Id = entity.Id,
        Date = entity.Date,
        Amount = entity.Amount,
        Source = entity.Source,
        Description = entity.Description,
    };
}

public class CashIncomeDto : CashIncomeBase;

public record CashIncomeRequest(
    DateTimeOffset Date,
    decimal CashAmount,
    decimal TallyListAmount,
    decimal SumUpAmount,
    string? Description);
