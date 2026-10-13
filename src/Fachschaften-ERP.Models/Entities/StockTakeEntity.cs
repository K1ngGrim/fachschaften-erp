using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>Inventur: gezählte Bestände mit Soll zum Buchungszeitpunkt.</summary>
public class StockTakeEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string? Note { get; set; }
    public List<StockTakePositionEntity> Positions { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

public class StockTakePositionEntity
{
    public Guid Id { get; set; }
    public Guid StockTakeId { get; set; }
    public StockTakeEntity? StockTake { get; set; }

    public Guid ProductId { get; set; }
    public ProductEntity? Product { get; set; }

    /// <summary>Bestand laut System zum Zeitpunkt der Buchung.</summary>
    public int ExpectedStock { get; set; }
    public int CountedStock { get; set; }

    /// <summary>Einkaufspreis zum Zeitpunkt der Inventur, für die Bewertung der Differenz.</summary>
    public decimal UnitPurchasePrice { get; set; }
}
