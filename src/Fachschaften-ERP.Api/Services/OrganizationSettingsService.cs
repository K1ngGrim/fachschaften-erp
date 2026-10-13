using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services;

/// <summary>Liest die Organisationseinstellungen; ohne gespeicherten Datensatz gelten die Standardwerte.</summary>
public class OrganizationSettingsService(CoreContext db)
{
    public async Task<OrganizationSettingsEntity> GetAsync(CancellationToken cancellationToken = default) =>
        await db.OrganizationSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == OrganizationSettingsEntity.SingletonId, cancellationToken)
        ?? new OrganizationSettingsEntity();
}
