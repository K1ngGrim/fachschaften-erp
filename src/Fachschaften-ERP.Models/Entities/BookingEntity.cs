using System.Text.Json.Serialization;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class BookingBase
{
    public Guid Id { get; set; }
    public DateTimeOffset Date { get; set; }

    /// <summary>Vorzeichenbehaftet: positiv = Einnahme, negativ = Ausgabe.</summary>
    public decimal Amount { get; set; }

    public string Description { get; set; } = string.Empty;

    /// <summary>Bei Umbuchungen zwischen Kassenbüchern nicht gesetzt.</summary>
    public TaxArea? TaxArea { get; set; }

    public Guid? CategoryId { get; set; }

    /// <summary>Nur gesetzt, wenn das Geld über eine Bargeldkasse läuft.</summary>
    public Guid? CashBookId { get; set; }

    public string? ReceiptUrl { get; set; }
    public CashIncomeSource? Source { get; set; }
    public Guid? TransferGroupId { get; set; }
}

public class BookingEntity : BookingBase, IBaseEntity
{
    public BookingCategoryEntity? Category { get; set; }
    public CashBookEntity? CashBook { get; set; }

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TaxArea
{
    Ideell,
    Zweckbetrieb,
    Wirtschaftsbetrieb,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CashIncomeSource
{
    Cash,
    TallyList,
    SumUp,
}
