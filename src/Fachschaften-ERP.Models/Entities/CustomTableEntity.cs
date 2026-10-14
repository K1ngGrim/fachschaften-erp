using System.Text.Json;
using System.Text.Json.Serialization;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>Von Benutzern definierte Tabelle; die Spalten liegen als JSON an der Tabelle.</summary>
public class CustomTableEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<CustomTableColumn> Columns { get; set; } = [];

    public List<CustomTableRowEntity> Rows { get; set; } = [];

    /// <summary>
    /// Einträge sind Ende-zu-Ende-verschlüsselt (<see cref="CustomTableRowEntity.EncryptedValues"/>);
    /// nur Tresore mit einem <see cref="CustomTableKeyEntity"/> können sie lesen.
    /// </summary>
    public bool IsConfidential { get; set; }

    /// <summary>Wird bei jedem Schlüsselwechsel erhöht; alle Einträge nutzen den aktuellen Schlüssel.</summary>
    public int KeyVersion { get; set; }

    public List<CustomTableKeyEntity> Keys { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

/// <param name="Id">Stabiler Schlüssel der Spalte; Werte der Zeilen hängen daran, nicht am Namen.</param>
public record CustomTableColumn(
    string Id,
    string Label,
    CustomTableColumnType Type,
    bool Required,
    IList<string>? Options);

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CustomTableColumnType
{
    Text,
    LongText,
    Number,
    Currency,
    Date,
    Boolean,
    Select,
}

public class CustomTableRowEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public Guid TableId { get; set; }
    public CustomTableEntity? Table { get; set; }

    /// <summary>Werte je Spalten-Id; bei vertraulichen Tabellen leer.</summary>
    public JsonDocument Values { get; set; } = JsonDocument.Parse("{}");

    /// <summary>Bei vertraulichen Tabellen: Werte als AES-GCM-Chiffretext (Base64 aus IV und Chiffretext).</summary>
    public string? EncryptedValues { get; set; }

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}
