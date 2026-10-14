using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Fachschaften_ERP.Api.Services.Modules;

/// <summary>Ist das Modul ausgeschaltet, antworten seine Endpunkte mit 404, als gäbe es sie nicht.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequireModuleAttribute(string key) : Attribute, IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var modules = context.HttpContext.RequestServices.GetRequiredService<ModuleService>();
        if (!await modules.IsEnabledAsync(key, context.HttpContext.RequestAborted))
        {
            context.Result = new NotFoundResult();
            return;
        }

        await next();
    }
}
