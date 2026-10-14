using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services.Backup;

/// <summary>
/// Startet Backups im Hintergrund und sorgt dafür, dass immer nur eines läuft. Plant außerdem das
/// tägliche Backup: jede Minute wird geprüft, ob das heutige fällig ist und noch fehlt (ein
/// verpasstes, z. B. weil der Server aus war, wird so nachgeholt).
/// </summary>
public sealed class BackupRunner(
    IServiceScopeFactory scopeFactory,
    IHostApplicationLifetime lifetime,
    ILogger<BackupRunner> logger) : BackgroundService
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    public bool IsRunning => _gate.CurrentCount == 0;

    /// <summary>Startet ein Backup; null, wenn schon eines läuft.</summary>
    public async Task<Guid?> StartAsync(BackupTrigger trigger, Guid? userId)
    {
        if (!await _gate.WaitAsync(0)) return null;

        Guid runId;
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CoreContext>();
            var run = new BackupRunEntity
            {
                Id = Guid.NewGuid(),
                Trigger = trigger,
                TriggeredById = userId,
                Status = BackupStatus.Running,
                Started = DateTimeOffset.UtcNow,
            };
            db.BackupRuns.Add(run);
            await db.SaveChangesAsync();
            runId = run.Id;
        }
        catch
        {
            _gate.Release();
            throw;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<BackupService>()
                    .ExecuteAsync(runId, lifetime.ApplicationStopping);
            }
            catch (Exception e)
            {
                logger.LogError(e, "Backup {RunId} abgebrochen", runId);
            }
            finally
            {
                _gate.Release();
            }
        });
        return runId;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await MarkInterruptedRunsAsync(stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                if (await IsDueAsync(stoppingToken)) await StartAsync(BackupTrigger.Scheduled, null);
            }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(e, "Prüfen des Backup-Zeitplans fehlgeschlagen");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task<bool> IsDueAsync(CancellationToken ct)
    {
        if (IsRunning) return false;

        using var scope = scopeFactory.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<BackupService>();
        var settings = await service.GetSettingsAsync(ct);
        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.WebDavUrl)) return false;

        var due = LastScheduledTime(settings.Time, service.TimeZone, DateTimeOffset.UtcNow);
        var db = scope.ServiceProvider.GetRequiredService<CoreContext>();
        return !await db.BackupRuns.AnyAsync(r => r.Trigger == BackupTrigger.Scheduled && r.Started >= due, ct);
    }

    /// <summary>Letzter planmäßiger Zeitpunkt bis jetzt (heute oder gestern zur eingestellten Uhrzeit).</summary>
    public static DateTimeOffset LastScheduledTime(TimeOnly time, TimeZoneInfo zone, DateTimeOffset now)
    {
        var localNow = TimeZoneInfo.ConvertTime(now, zone);
        var today = localNow.Date + time.ToTimeSpan();
        var local = today <= localNow.DateTime ? today : today.AddDays(-1);
        return new DateTimeOffset(local, zone.GetUtcOffset(local));
    }

    /// <summary>Läufe, die beim letzten Beenden der Anwendung noch liefen, als abgebrochen markieren.</summary>
    private async Task MarkInterruptedRunsAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CoreContext>();
            await db.BackupRuns
                .Where(r => r.Status == BackupStatus.Running)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, BackupStatus.Failed)
                    .SetProperty(r => r.Finished, DateTimeOffset.UtcNow)
                    .SetProperty(r => r.Message, "Abgebrochen, weil die Anwendung beendet wurde."), ct);
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(e, "Unterbrochene Backups ließen sich nicht markieren");
        }
    }
}
