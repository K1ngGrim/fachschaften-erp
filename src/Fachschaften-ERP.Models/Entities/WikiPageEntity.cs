using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>Wiki-Seite mit Markdown-Inhalt, z. B. für Abläufe und Anleitungen.</summary>
public class WikiPageEntity : IBaseEntity
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Optionale Gruppierung in der Übersicht.</summary>
    public string? Category { get; set; }

    public string Content { get; set; } = string.Empty;

    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}
