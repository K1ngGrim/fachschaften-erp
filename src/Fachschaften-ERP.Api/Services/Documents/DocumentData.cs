using System.Globalization;
using System.Text.Json;
using Fachschaften_ERP.Models.Entities;

namespace Fachschaften_ERP.Api.Services.Documents;

/// <summary>
/// Erzeugt die data.json, die Vorlagen mit <c>#let daten = json("data.json")</c> lesen:
/// <list type="bullet">
/// <item><c>felder</c>: Werte je Feld-Id (Datum als JJJJ-MM-TT, Zahlen als Zahl, Ja/Nein als bool)</item>
/// <item><c>text</c>: dieselben Werte fertig formatiert („14.10.2026“, „12,50 €“, „Ja“)</item>
/// <item><c>variablen</c>: gemeinsame Werte aller Vorlagen (Einstellungen → Variablen)</item>
/// <item><c>erstellt</c>, <c>organisation</c></item>
/// </list>
/// Jedes Feld ist immer vorhanden (leer: <c>none</c> bzw. ""), damit Vorlagen nicht an fehlenden Schlüsseln scheitern.
/// </summary>
public static class DocumentData
{
    private static readonly CultureInfo German = CultureInfo.GetCultureInfo("de-DE");

    public static string Build(
        IList<CustomTableColumn> fields,
        JsonElement values,
        string organization,
        DateTimeOffset localNow,
        IReadOnlyDictionary<string, string>? variables = null)
    {
        var raw = new Dictionary<string, object?>();
        var text = new Dictionary<string, string>();

        foreach (var field in fields)
        {
            var has = values.ValueKind == JsonValueKind.Object && values.TryGetProperty(field.Id, out var value) &&
                      value.ValueKind != JsonValueKind.Null;
            if (!has)
            {
                var isBool = field.Type == CustomTableColumnType.Boolean;
                raw[field.Id] = isBool ? false : null;
                text[field.Id] = isBool ? "Nein" : string.Empty;
                continue;
            }

            var element = values.GetProperty(field.Id);
            switch (field.Type)
            {
                case CustomTableColumnType.Number when element.TryGetDecimal(out var number):
                    raw[field.Id] = number;
                    text[field.Id] = number.ToString("#,##0.######", German);
                    break;
                case CustomTableColumnType.Currency when element.TryGetDecimal(out var amount):
                    raw[field.Id] = amount;
                    text[field.Id] = amount.ToString("#,##0.00", German) + " €";
                    break;
                case CustomTableColumnType.Boolean:
                    var flag = element.ValueKind == JsonValueKind.True;
                    raw[field.Id] = flag;
                    text[field.Id] = flag ? "Ja" : "Nein";
                    break;
                case CustomTableColumnType.Date when DateOnly.TryParseExact(element.GetString(), "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var date):
                    raw[field.Id] = element.GetString();
                    text[field.Id] = date.ToString("dd.MM.yyyy", German);
                    break;
                default:
                    var s = element.ValueKind == JsonValueKind.String ? element.GetString() ?? "" : element.GetRawText();
                    raw[field.Id] = s;
                    text[field.Id] = s;
                    break;
            }
        }

        return JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["felder"] = raw,
            ["text"] = text,
            ["variablen"] = variables ?? new Dictionary<string, string>(),
            ["erstellt"] = localNow.ToString("dd.MM.yyyy", German),
            ["organisation"] = organization,
        });
    }

    /// <summary>Startpunkt für neue Vorlagen: zeigt, wie man an die Felder kommt.</summary>
    public const string ExampleSource =
        """
        #let daten = json("data.json")
        #set page(paper: "a4", margin: 2.5cm)
        #set text(lang: "de", size: 11pt)

        #daten.organisation #h(1fr) #daten.erstellt

        = Bescheinigung

        Hiermit bestätigen wir, dass *#daten.text.name* am #daten.text.datum
        teilgenommen hat.

        #v(2cm)
        #line(length: 6cm)
        Unterschrift
        """;
}
