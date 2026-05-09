using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class ItemTypeEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Icon { get; set; }

    public ICollection<ProductEntity> Products { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}