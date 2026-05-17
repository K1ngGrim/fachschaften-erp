using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class SupplierEntity : SupplierBase, IBaseEntity
{
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

public class SupplierBase
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
}