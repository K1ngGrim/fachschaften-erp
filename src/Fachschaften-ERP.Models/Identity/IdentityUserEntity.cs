using Fachschaften_ERP.Models.Core;
using Microsoft.AspNetCore.Identity;

namespace Fachschaften_ERP.Models.Identity;

public class IdentityUserEntity : IdentityUser<Guid>, IBaseEntity
{
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}