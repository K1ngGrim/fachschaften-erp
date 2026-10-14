using System.Text.Json;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>
/// Typst-Vorlage. Quelltext, Felder und Dateien stehen in Versionen; jede inhaltliche Änderung
/// ergibt eine neue Version, damit abgelegte Dokumente ihrer Vorlage zuordenbar bleiben.
/// </summary>
public class DocumentTemplateEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>
    /// Erzeugte Dokumente ablegen (z. B. Verträge). Aus: nur erzeugen und drucken, nichts
    /// speichern – für personenbezogene Dokumente.
    /// </summary>
    public bool StoreDocuments { get; set; }

    public int CurrentVersion { get; set; }
    public List<DocumentTemplateVersionEntity> Versions { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>Unveränderlicher Stand einer Vorlage.</summary>
public class DocumentTemplateVersionEntity
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public DocumentTemplateEntity? Template { get; set; }
    public int Version { get; set; }

    /// <summary>Typst-Quelltext (main.typ).</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>Felder zum Ausfüllen; die Id ist der Schlüssel in data.json.</summary>
    public List<CustomTableColumn> Fields { get; set; } = [];

    /// <summary>Dateien dieser Version (Bilder, Schriften, weitere .typ-Dateien).</summary>
    public List<Guid> AssetIds { get; set; } = [];

    public string? Comment { get; set; }
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
}

/// <summary>Datei einer Vorlage; unveränderlich, damit alte Versionen gleich bleiben.</summary>
public class DocumentAssetEntity
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Data { get; set; } = [];
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
}

/// <summary>Abgelegtes Dokument (nur bei Vorlagen mit <see cref="DocumentTemplateEntity.StoreDocuments"/>).</summary>
public class GeneratedDocumentEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public Guid TemplateVersionId { get; set; }
    public int TemplateVersion { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Eingegebene Werte je Feld-Id.</summary>
    public JsonDocument Values { get; set; } = JsonDocument.Parse("{}");

    public byte[] Pdf { get; set; } = [];

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// Datei, die allen Vorlagen zur Verfügung steht (z. B. Logos, Schriften, gemeinsame .typ-Dateien).
/// Ordner werden nicht eigens verwaltet: <see cref="Path"/> ist der relative Pfad samt Unterordnern.
/// </summary>
public class DocumentPublicFileEntity
{
    public Guid Id { get; set; }

    /// <summary>Relativer Pfad mit "/" als Trenner, z. B. "logos/fachschaft.png".</summary>
    public string Path { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;
    public byte[] Data { get; set; } = [];
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
}

/// <summary>Wert, den alle Vorlagen über <c>daten.variablen.&lt;schlüssel&gt;</c> lesen.</summary>
public class DocumentVariableEntity
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}
