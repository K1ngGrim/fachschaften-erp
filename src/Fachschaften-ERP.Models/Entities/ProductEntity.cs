using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

[NotMapped]
public class ProductBase
{
    public string Name { get; set; } = null!;
    
    public decimal PurchasePrice { get; set; }
    public decimal InternalSellingPrice { get; set; }
    public decimal ExternalSellingPrice { get; set; }

    /// <summary>
    /// Einheit für Bestand, Mindestbestand und Einkaufspreis, z. B. Kiste.
    /// Ohne Angabe gilt <see cref="DefaultUnit"/>.
    /// </summary>
    public string? Unit { get; set; }

    /// <summary>
    /// Einheit der Verkaufspreise ("Preis pro …"), z. B. Flasche; kann von <see cref="Unit"/>
    /// abweichen. Ohne Angabe gilt <see cref="Unit"/>.
    /// </summary>
    public string? PriceUnit { get; set; }

    public const string DefaultUnit = "Stück";
    public const int MaxUnitLength = 50;
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