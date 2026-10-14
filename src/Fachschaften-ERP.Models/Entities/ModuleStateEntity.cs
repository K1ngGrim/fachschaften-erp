namespace Fachschaften_ERP.Models.Entities;

/// <summary>Ob ein optionales Modul eingeschaltet ist; fehlt der Datensatz, gilt die Voreinstellung des Moduls.</summary>
public class ModuleStateEntity
{
    public string Key { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
}
