using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class ProductEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;

    public Guid ItemTypeId { get; set; }
    public ItemTypeEntity ItemType { get; set; } = null!;

    public Guid? SupplierId { get; set; }
    public SupplierEntity? Supplier { get; set; }

    public decimal PurchasePrice { get; set; }
    public decimal SellingPrice { get; set; }
    public int Stock { get; set; }
    public int LowStockThreshold { get; set; }
    public bool TrackStock { get; set; }

    public JsonDocument CustomFieldValues { get; set; } = JsonDocument.Parse("{}");

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}