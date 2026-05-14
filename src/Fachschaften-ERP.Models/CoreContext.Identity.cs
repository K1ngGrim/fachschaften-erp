using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Models;

public partial class CoreContext
{
    private static string IdentitySchema => "identity";

    public DbSet<InviteEntity> Invites => Set<InviteEntity>();

    private static void OnIdentityCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IdentityUserEntity>(entity =>
        {
            entity.ToTable("Users", IdentitySchema);
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<InviteEntity>(entity =>
        {
            entity.ToTable("Invites", IdentitySchema);
            entity.HasKey(x => x.Id);
        });

        modelBuilder.Entity<IdentityRoleEntity>(entity => { entity.ToTable("Roles", IdentitySchema); });
        modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("UserRoles", IdentitySchema);
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("UserClaims", IdentitySchema);
        modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("UserLogins", IdentitySchema);
        modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("RoleClaims", IdentitySchema);
        modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("UserTokens", IdentitySchema);
    }
}