namespace Fachschaften_ERP.Models.Entities;

/// <summary>Einstellungen der Fachschaft; es gibt genau einen Datensatz (Id = 1).</summary>
public class OrganizationSettingsEntity
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;
    public string Name { get; set; } = "Fachschaften ERP";
    public string? Subtitle { get; set; }

    /// <summary>Akzentfarbe als #rrggbb.</summary>
    public string AccentColor { get; set; } = "#e8912a";

    /// <summary>Logo als data:-URL (PNG, JPEG, WebP oder SVG).</summary>
    public string? LogoDataUrl { get; set; }

    /// <summary>Verantwortliche Stelle für die Datenschutzhinweise (mehrzeilig).</summary>
    public string? PrivacyContact { get; set; }

    public string? ImprintUrl { get; set; }

    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
}
