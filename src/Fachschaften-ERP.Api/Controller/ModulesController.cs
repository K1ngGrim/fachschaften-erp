using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Modules;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>Optionale Module ein- und ausschalten.</summary>
[ApiController]
[Route("/api/modules")]
public class ModulesController(CoreContext db, ModuleService modules) : ControllerBase
{
    /// <summary>Alle Module mit Zustand; braucht jede angemeldete Person für die Navigation.</summary>
    [HttpGet]
    public async Task<ActionResult<IList<ModuleDto>>> GetAll()
    {
        var states = await modules.GetStatesAsync();
        return Ok(AppModules.All.Select(m => new ModuleDto(m.Key, m.Name, m.Description, states[m.Key])).ToList());
    }

    [RequirePermission(PermissionType.SettingsWrite)]
    [HttpPut("{key}")]
    public async Task<ActionResult<ModuleDto>> SetEnabled(string key, SetModuleEnabledRequest request)
    {
        var module = AppModules.Find(key);
        if (module is null) return NotFound();

        var state = await db.ModuleStates.FirstOrDefaultAsync(m => m.Key == key);
        if (state is null)
        {
            state = new ModuleStateEntity { Key = key };
            db.ModuleStates.Add(state);
        }

        state.Enabled = request.Enabled;
        state.ModifierId = ((Invoker)User).UserId;
        state.Modified = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        modules.Invalidate();

        return Ok(new ModuleDto(module.Key, module.Name, module.Description, request.Enabled));
    }
}

public record ModuleDto(string Key, string Name, string Description, bool Enabled);

public record SetModuleEnabledRequest(bool Enabled);
