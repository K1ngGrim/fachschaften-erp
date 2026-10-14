namespace Fachschaften_ERP.Api.Services.Modules;

/// <param name="Key">Stabiler Schlüssel, auch im Frontend.</param>
/// <param name="DefaultEnabled">Gilt, solange niemand den Schalter umgelegt hat.</param>
public record AppModule(string Key, string Name, string Description, bool DefaultEnabled);

/// <summary>
/// Optionale Module. Ein neues Modul braucht hier einen Eintrag, <see cref="RequireModuleAttribute"/>
/// an seinen Controllern und im Frontend <c>module</c> an Navigation und Routen.
/// </summary>
public static class AppModules
{
    public const string Documents = "documents";

    public static readonly IReadOnlyList<AppModule> All =
    [
        new(Documents, "Dokumente",
            "Typst-Vorlagen online ausfüllen und als PDF erzeugen, z. B. Bescheinigungen oder Verträge.", true),
    ];

    public static AppModule? Find(string key) => All.FirstOrDefault(m => m.Key == key);
}
