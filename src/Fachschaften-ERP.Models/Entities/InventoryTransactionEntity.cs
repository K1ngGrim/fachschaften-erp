using System.Diagnostics.CodeAnalysis;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class InventoryTransactionEntity : IBaseEntity
{
    [NotNull]
    public Guid Id { get; set; }
    
    [NotNull]
    public Guid ProductId { get; set; }
    public ProductBase Product { get; set; } = null!;

    public int Quantity { get; set; } = 0;
    
    public InventoryTransactionType Type { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Note { get; set; }
    
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

public enum InventoryTransactionType
{
    Delivery,
    Sale,
    Adjustment,
    Return,
    Loss,
}