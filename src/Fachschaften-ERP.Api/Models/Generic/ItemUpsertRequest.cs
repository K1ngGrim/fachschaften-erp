namespace Fachschaften_ERP.Api.Models.Generic;

public class ItemUpsertRequest<T>
{
    public Guid? Id { get; set; }
    public required T Value { get; set; }
}