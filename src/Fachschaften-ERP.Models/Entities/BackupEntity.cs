using System.Text.Json.Serialization;

namespace Fachschaften_ERP.Models.Entities;

/// <summary>Einstellungen für das automatische Backup per WebDAV; es gibt genau einen Datensatz (Id = 1).</summary>
public class BackupSettingsEntity
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    public bool Enabled { get; set; }

    /// <summary>WebDAV-Ordner, in den die Backups geladen werden.</summary>
    public string? WebDavUrl { get; set; }

    public string? Username { get; set; }

    /// <summary>WebDAV-Passwort, mit ASP.NET Data Protection verschlüsselt.</summary>
    public string? ProtectedPassword { get; set; }

    /// <summary>Uhrzeit des täglichen Backups (Ortszeit, siehe Backup:TimeZone).</summary>
    public TimeOnly Time { get; set; } = new(3, 0);

    /// <summary>So viele Backups bleiben auf dem WebDAV liegen; ältere werden gelöscht.</summary>
    public int KeepCount { get; set; } = 30;

    /// <summary>Lesbare CSV-Dateien und Wiki-Seiten zusätzlich zum Datenbank-Dump.</summary>
    public bool IncludeCsv { get; set; } = true;

    /// <summary>Passwort für die AES-verschlüsselte ZIP, mit Data Protection verschlüsselt; leer = unverschlüsselt.</summary>
    public string? ProtectedArchivePassword { get; set; }

    /// <summary>Bei fehlgeschlagenem Backup geht eine Mail an diese Adresse.</summary>
    public string? NotifyEmail { get; set; }

    public Guid? ModifierId { get; set; }
    public DateTimeOffset? Modified { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BackupStatus
{
    Running,
    Succeeded,
    Failed,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BackupTrigger
{
    Scheduled,
    Manual,
}

public class BackupRunEntity
{
    public Guid Id { get; set; }
    public BackupTrigger Trigger { get; set; }
    public Guid? TriggeredById { get; set; }
    public BackupStatus Status { get; set; }
    public DateTimeOffset Started { get; set; }
    public DateTimeOffset? Finished { get; set; }
    public string? FileName { get; set; }
    public long? SizeBytes { get; set; }

    /// <summary>Fehlermeldung bzw. Hinweise (z. B. übersprungene Teile).</summary>
    public string? Message { get; set; }
}
