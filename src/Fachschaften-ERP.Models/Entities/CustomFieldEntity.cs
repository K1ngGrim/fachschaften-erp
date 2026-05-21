using System.ComponentModel.DataAnnotations;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class CustomFieldEntity : IBaseEntity
{
    public Guid Id { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public required CustomFieldType Type { get; set; }
    
    public bool Required { get; set; }
    public int Order { get; set; }
    
    public ICollection<ItemTypeEntity> ItemTypes { get; set; } = [];
    public IList<string> SelectOptions { get; set; } = [];
    
    public Guid CreatorId { get; set; }
    public DateTimeOffset Created { get; set; }
    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
    public bool IsActive { get; set; }
}

public enum CustomFieldType
{
    Text,
    Number,
    Date,
    Boolean,
    Select,
    MultiSelect
}