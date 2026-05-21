using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

[ApiController]
[Route("/api/custom-fields")]
public class CustomFieldsController(
    CoreContext db
    ): ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetAll()
    {
        var fields = await db.CustomFields
            .Where(x => x.IsActive)
            .Select(x => new CustomFieldDto(x.Id, x.Name, x.Type, x.Order))
            .OrderBy(x => x.Order)
            .ToListAsync();
        
        return Ok(fields);
    }
    
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        return Ok();
    }

    [HttpGet("type/{typeId:guid}")]
    public async Task<ActionResult<IList<CustomFieldDto>>> GetByType(Guid typeId)
    {
        var itemType = await db.ItemTypes
            .Where(x => x.IsActive)
            .SingleOrDefaultAsync();
        
        if (itemType is null) return NotFound();

        var fields = await db.CustomFields
            .Where(x => x.ItemTypes.Any(x => x.Id == itemType.Id))
            .Select(x => new CustomFieldDto(x.Id, x.Name, x.Type, x.Order))
            .ToListAsync();
        
        return Ok(fields);
    }
    
}

public record CustomFieldDto(Guid Id, string Name, CustomFieldType Type, int Order = 0);