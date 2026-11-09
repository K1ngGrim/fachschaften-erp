using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

[NotMapped]
public class ProductBase
{
    public string Name { get; set; } = null!;
    
    /// <summary>Einkaufspreis pro <see cref="PriceUnit"/>, z. B. pro Flasche.</summary>
    public decimal PurchasePrice { get; set; }
    /// <summary>Verkaufspreis für Mitglieder pro <see cref="PriceUnit"/>.</summary>
    public decimal InternalSellingPrice { get; set; }
    /// <summary>Verkaufspreis für Gäste pro <see cref="PriceUnit"/>.</summary>
    public decimal ExternalSellingPrice { get; set; }

    /// <summary>
    /// Einheit für Bestand, Mindestbestand und Lieferungen, z. B. Kiste.
    /// Ohne Angabe gilt <see cref="DefaultUnit"/>.
    /// </summary>
    public string? Unit { get; set; }

    /// <summary>
    /// Einheit, auf die sich alle Preise beziehen ("Preis pro …"), z. B. Flasche; kann von
    /// <see cref="Unit"/> abweichen. Ohne Angabe gilt <see cref="Unit"/>.
    /// </summary>
    public string? PriceUnit { get; set; }

    /// <summary>
    /// Wie viele <see cref="PriceUnit"/> eine <see cref="Unit"/> enthält, z. B. 20 Flaschen pro Kiste.
    /// Ohne eigene Preiseinheit immer 1. Rechnet Preise in Werte des Bestands um.
    /// </summary>
    public decimal PriceUnitsPerStockUnit { get; set; } = 1;

    public const string DefaultUnit = "Stück";
    public const int MaxUnitLength = 50;

    /// <summary>Preis pro Bestandseinheit, z. B. Flaschenpreis × 20 = Kistenpreis.</summary>
    public decimal PerStockUnit(decimal pricePerPriceUnit) => pricePerPriceUnit * PriceUnitsPerStockUnit;

    /// <summary>Warenwert eines Bestands zum Einkaufspreis.</summary>
    public decimal StockValue(decimal stock) => stock * PerStockUnit(PurchasePrice);

    /// <summary>Beide Einheiten bezeichnen dasselbe; dann ist der Umrechnungsfaktor 1.</summary>
    public static bool SameUnit(string? unit, string? priceUnit) =>
        string.IsNullOrWhiteSpace(priceUnit)
        || string.Equals((unit ?? DefaultUnit).Trim(), priceUnit.Trim(), StringComparison.OrdinalIgnoreCase);
    public int LowStockThreshold { get; set; }
    public bool TrackStock { get; set; }
    
    public JsonDocument CustomFieldValues { get; set; } = JsonDocument.Parse("{}");
    
    public Guid ItemTypeId { get; set; }
    public Guid? SupplierId { get; set; }
}

public class ProductEntity : ProductBase, IBaseEntity
{
    public Guid Id { get; set; }
    public ItemTypeEntity ItemType { get; set; } = null!;

    public SupplierEntity? Supplier { get; set; }

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}