using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class DeliveryBase
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public DateTimeOffset DeliveryDate { get; set; }
    public string? DocumentNumber { get; set; }
    public string? ReceiptUrl { get; set; }
    public string? Note { get; set; }
}

public class DeliveryEntity : DeliveryBase, IBaseEntity
{
    public SupplierEntity Supplier { get; set; } = null!;
    public ICollection<DeliveryPositionEntity> Positions { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

public class DeliveryPositionEntity
{
    public Guid Id { get; set; }

    public Guid DeliveryId { get; set; }
    public DeliveryEntity Delivery { get; set; } = null!;

    public Guid ProductId { get; set; }
    public ProductEntity Product { get; set; } = null!;

    public int Quantity { get; set; }
    public decimal UnitPurchasePrice { get; set; }
}
