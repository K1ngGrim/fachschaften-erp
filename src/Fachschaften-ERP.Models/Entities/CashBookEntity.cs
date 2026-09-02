using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class CashBookBase
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;

    /// <summary>Gesetzt bei Unterkassen; die Hauptkasse hat keinen Parent.</summary>
    public Guid? ParentId { get; set; }
}

public class CashBookEntity : CashBookBase, IBaseEntity
{
    public CashBookEntity? Parent { get; set; }
    public ICollection<CashBookEntity> Children { get; set; } = [];
    public ICollection<BookingEntity> Bookings { get; set; } = [];

    public bool IsClosed { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}
