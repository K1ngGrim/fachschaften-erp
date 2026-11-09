using System.Text.Json.Serialization;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>
/// Einnahmen der Getränkekasse (Bar, Strichliste, SumUp). Läuft bewusst getrennt von den
/// Buchungen der Finanzen und fließt nicht automatisch in Kassenbücher oder den Jahresabschluss.
/// </summary>
public class CashIncomeBase
{
    public Guid Id { get; set; }
    public DateTimeOffset Date { get; set; }
    public decimal Amount { get; set; }
    public CashIncomeSource Source { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class CashIncomeEntity : CashIncomeBase, IBaseEntity
{
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CashIncomeSource
{
    Cash,
    TallyList,
    SumUp,
}
