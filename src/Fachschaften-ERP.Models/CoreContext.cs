using Fachschaften_ERP.Models.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Models;

public partial class CoreContext(DbContextOptions options) : IdentityDbContext <
    IdentityUserEntity,
    IdentityRoleEntity,
    Guid
>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasDefaultSchema("erp");

        OnIdentityCreating(builder);
        OnErpCreating(builder);
    }
}