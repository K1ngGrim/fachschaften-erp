using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Serialization;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class InventoryTransactionEntity : IBaseEntity
{
    [NotNull]
    public Guid Id { get; set; }
    
    [NotNull]
    public Guid ProductId { get; set; }
    public ProductEntity Product { get; set; } = null!;

    public int Quantity { get; set; } = 0;
    
    public decimal UnitPurchasePrice { get; set; }
    public decimal UnitSellingPrice { get; set; }
    
    public InventoryTransactionType Type { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Note { get; set; }
    
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum InventoryTransactionType
{
    Delivery,
    Sale,
    Adjustment,
    Return,
    Loss,
}