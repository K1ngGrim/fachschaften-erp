using Fachschaften_ERP.Models.Core;
using Microsoft.AspNetCore.Identity;

namespace Fachschaften_ERP.Models.Entities.Identity;

public class IdentityUserEntity : IdentityUser<Guid>
{
    /// <summary>Name für die Anzeige; der Benutzername ist meist die E-Mail-Adresse.</summary>
    public string? DisplayName { get; set; }
}