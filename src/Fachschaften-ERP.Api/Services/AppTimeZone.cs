namespace Fachschaften_ERP.Api.Services;

/// <summary>Zeitzone für Uhrzeiten und Datumsangaben der Fachschaft (Backup-Zeitplan, Dokumente).</summary>
public static class AppTimeZone
{
    /// <summary>Aus <c>Backup:TimeZone</c>, sonst Europe/Berlin; unbekannte Zonen fallen auf UTC zurück.</summary>
    public static TimeZoneInfo From(IConfiguration configuration)
    {
        var id = configuration["Backup:TimeZone"] ?? "Europe/Berlin";
        return TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) ? zone : TimeZoneInfo.Utc;
    }
}
