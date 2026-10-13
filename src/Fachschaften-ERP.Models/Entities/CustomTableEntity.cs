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

    /// <summary>Werte je Spalten-Id.</summary>
    public JsonDocument Values { get; set; } = JsonDocument.Parse("{}");

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}
