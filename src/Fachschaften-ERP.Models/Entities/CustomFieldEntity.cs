using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Fachschaften_ERP.Models.Core;

namespace Fachschaften_ERP.Models.Entities;

public class CustomFieldBase
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public CustomFieldType Type { get; set; }
    public bool Required { get; set; }
    public int Order { get; set; }
    public IList<string> SelectOptions { get; set; } = [];
}

public class CustomFieldEntity : CustomFieldBase, IBaseEntity
{
    public ICollection<ItemTypeEntity> ItemTypes { get; set; } = [];
    
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