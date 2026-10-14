using Fachschaften_ERP.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Fachschaften_ERP.Api.Services.Modules;

/// <summary>Welche Module eingeschaltet sind; kurz zwischengespeichert, weil jede Modul-Anfrage das prüft.</summary>
public class ModuleService(CoreContext db, IMemoryCache cache)
{
    private const string CacheKey = "module-states";

    public async Task<IReadOnlyDictionary<string, bool>> GetStatesAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, bool>? cached) && cached is not null)
            return cached;

        var stored = await db.ModuleStates.AsNoTracking().ToDictionaryAsync(m => m.Key, m => m.Enabled, ct);
        var states = AppModules.All.ToDictionary(m => m.Key, m => stored.GetValueOrDefault(m.Key, m.DefaultEnabled));
        cache.Set(CacheKey, (IReadOnlyDictionary<string, bool>)states, TimeSpan.FromMinutes(5));
        return states;
    }

    public async Task<bool> IsEnabledAsync(string key, CancellationToken ct = default) =>
        (await GetStatesAsync(ct)).GetValueOrDefault(key);

    public void Invalidate() => cache.Remove(CacheKey);
}
