using System.Globalization;
using System.Text;
using System.Text.Json;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services.Backup;

/// <summary>
/// Lesbare Kopie der Daten für das Backup: CSV im Excel-Format (Semikolon, Dezimalkomma, UTF-8 mit
/// BOM) und Wiki-Seiten als Markdown. Vertrauliche Tabellen fehlen bewusst: Der Server kann sie
/// nicht entschlüsseln; sie stecken nur verschlüsselt im Datenbank-Dump.
/// </summary>
public class BackupCsvExporter(CoreContext db)
{
    private static readonly CultureInfo German = CultureInfo.GetCultureInfo("de-DE");

    /// <summary>Liefert Dateipfad (im Archiv) und Inhalt.</summary>
    public async IAsyncEnumerable<(string Path, string Content)> ExportAsync(
        TimeZoneInfo timeZone,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        string Date(DateTimeOffset value) => TimeZoneInfo.ConvertTime(value, timeZone).ToString("dd.MM.yyyy", German);
        string DateTime(DateTimeOffset value) =>
            TimeZoneInfo.ConvertTime(value, timeZone).ToString("dd.MM.yyyy HH:mm", German);

        var itemTypes = await db.ItemTypes.ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        var suppliers = await db.Suppliers.ToDictionaryAsync(s => s.Id, s => s.Name, ct);
        var products = await db.Products.ToListAsync(ct);
        var productNames = products.ToDictionary(p => p.Id, p => p.Name);
        var stock = await db.InventoryTransactions
            .Where(t => t.IsActive)
            .GroupBy(t => t.ProductId)
            .Select(g => new { g.Key, Sum = g.Sum(t => t.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Sum, ct);

        var csv = new Csv("Name", "Typ", "Lieferant", "Bestand in", "Verkaufspreis pro", "Einkaufspreis",
            "VK Mitglieder", "VK Gäste", "Bestand", "Mindestbestand", "Bestand geführt", "Zusatzfelder", "Aktiv");
        foreach (var p in products.OrderBy(p => p.Name))
        {
            csv.Add(p.Name, itemTypes.GetValueOrDefault(p.ItemTypeId), p.SupplierId is { } s ? suppliers.GetValueOrDefault(s) : null,
                p.Unit ?? ProductBase.DefaultUnit, p.PriceUnit ?? p.Unit ?? ProductBase.DefaultUnit,
                p.PurchasePrice, p.InternalSellingPrice, p.ExternalSellingPrice,
                stock.GetValueOrDefault(p.Id), p.LowStockThreshold, p.TrackStock,
                p.CustomFieldValues.RootElement.GetRawText() is "{}" ? null : p.CustomFieldValues.RootElement.GetRawText(),
                p.IsActive);
        }
        yield return ("csv/artikel.csv", csv.ToString());

        csv = new Csv("Name", "Aktiv");
        foreach (var s in await db.Suppliers.OrderBy(s => s.Name).ToListAsync(ct)) csv.Add(s.Name, s.IsActive);
        yield return ("csv/lieferanten.csv", csv.ToString());

        csv = new Csv("Datum", "Artikel", "Art", "Menge", "EK je Einheit", "VK je Einheit", "Notiz");
        foreach (var t in await db.InventoryTransactions.Where(t => t.IsActive).OrderBy(t => t.Created).ToListAsync(ct))
        {
            csv.Add(DateTime(t.Created), productNames.GetValueOrDefault(t.ProductId), MovementLabel(t.Type),
                t.Quantity, t.UnitPurchasePrice, t.UnitSellingPrice, t.Note);
        }
        yield return ("csv/lagerbewegungen.csv", csv.ToString());

        csv = new Csv("Lieferdatum", "Lieferant", "Belegnummer", "Artikel", "Menge", "EK je Einheit", "Summe", "Notiz");
        var deliveries = await db.Deliveries.Where(d => d.IsActive).Include(d => d.Positions)
            .OrderBy(d => d.DeliveryDate).ToListAsync(ct);
        foreach (var d in deliveries)
        foreach (var pos in d.Positions)
        {
            csv.Add(Date(d.DeliveryDate), suppliers.GetValueOrDefault(d.SupplierId), d.DocumentNumber,
                productNames.GetValueOrDefault(pos.ProductId), pos.Quantity, pos.UnitPurchasePrice,
                pos.Quantity * pos.UnitPurchasePrice, d.Note);
        }
        yield return ("csv/lieferungen.csv", csv.ToString());

        csv = new Csv("Datum", "Notiz", "Artikel", "Soll", "Gezählt", "Differenz", "EK je Einheit", "Differenz (€)");
        var stockTakes = await db.StockTakes.Where(s => s.IsActive).Include(s => s.Positions)
            .OrderBy(s => s.Created).ToListAsync(ct);
        foreach (var take in stockTakes)
        foreach (var pos in take.Positions)
        {
            var difference = pos.CountedStock - pos.ExpectedStock;
            csv.Add(DateTime(take.Created), take.Note, productNames.GetValueOrDefault(pos.ProductId),
                pos.ExpectedStock, pos.CountedStock, difference, pos.UnitPurchasePrice, difference * pos.UnitPurchasePrice);
        }
        yield return ("csv/inventuren.csv", csv.ToString());

        var categories = await db.BookingCategories.ToListAsync(ct);
        var cashBooks = await db.CashBooks.ToListAsync(ct);
        csv = new Csv("Datum", "Betrag", "Beschreibung", "Kategorie", "Steuerbereich", "Kasse", "Quelle", "Beleg", "Umbuchung");
        foreach (var b in await db.Bookings.Where(b => b.IsActive).OrderBy(b => b.Date).ToListAsync(ct))
        {
            csv.Add(Date(b.Date), b.Amount, b.Description,
                categories.FirstOrDefault(c => c.Id == b.CategoryId)?.Name,
                b.TaxArea is { } area ? TaxAreaLabel(area) : null,
                cashBooks.FirstOrDefault(c => c.Id == b.CashBookId)?.Name,
                b.Source is { } source ? SourceLabel(source) : null,
                b.ReceiptUrl, b.TransferGroupId is null ? null : "Ja");
        }
        yield return ("csv/buchungen.csv", csv.ToString());

        csv = new Csv("Name", "Steuerbereich", "Aktiv");
        foreach (var c in categories.OrderBy(c => c.Name)) csv.Add(c.Name, TaxAreaLabel(c.TaxArea), c.IsActive);
        yield return ("csv/kategorien.csv", csv.ToString());

        csv = new Csv("Name", "Übergeordnet", "Abgeschlossen", "Abgeschlossen am", "Aktiv");
        foreach (var c in cashBooks.OrderBy(c => c.Name))
        {
            csv.Add(c.Name, cashBooks.FirstOrDefault(p => p.Id == c.ParentId)?.Name, c.IsClosed,
                c.ClosedAt is { } closed ? Date(closed) : null, c.IsActive);
        }
        yield return ("csv/kassenbuecher.csv", csv.ToString());

        var roles = await db.Roles.ToDictionaryAsync(r => r.Id, r => r.Name ?? string.Empty, ct);
        var userRoles = await db.UserRoles.ToListAsync(ct);
        csv = new Csv("Name", "E-Mail", "Benutzername", "Rollen", "Zwei-Faktor");
        foreach (var u in await db.Users.OrderBy(u => u.DisplayName ?? u.UserName).ToListAsync(ct))
        {
            var names = userRoles.Where(r => r.UserId == u.Id).Select(r => roles.GetValueOrDefault(r.RoleId)).Order();
            csv.Add(u.DisplayName, u.Email, u.UserName, string.Join(", ", names), u.TwoFactorEnabled);
        }
        yield return ("csv/benutzer.csv", csv.ToString());

        var fileNames = new HashSet<string>();
        var tables = await db.CustomTables.Where(t => t.IsActive && !t.IsConfidential).OrderBy(t => t.Name).ToListAsync(ct);
        foreach (var table in tables)
        {
            csv = new Csv(table.Columns.Select(c => c.Label).ToArray());
            var rows = await db.CustomTableRows.Where(r => r.TableId == table.Id && r.IsActive)
                .OrderBy(r => r.Created).ToListAsync(ct);
            foreach (var row in rows)
                csv.Add(table.Columns.Select(c => CustomValue(c, row.Values.RootElement)).ToArray());
            yield return ($"csv/tabellen/{UniqueName(table.Name, fileNames)}.csv", csv.ToString());
        }

        fileNames.Clear();
        foreach (var page in await db.WikiPages.Where(p => p.IsActive).OrderBy(p => p.Title).ToListAsync(ct))
        {
            var folder = string.IsNullOrWhiteSpace(page.Category) ? "" : Slug(page.Category) + "/";
            yield return ($"wiki/{folder}{UniqueName(page.Title, fileNames)}.md", $"# {page.Title}\n\n{page.Content}\n");
        }
    }

    private static object? CustomValue(CustomTableColumn column, JsonElement values)
    {
        if (!values.TryGetProperty(column.Id, out var value) || value.ValueKind == JsonValueKind.Null)
            return column.Type == CustomTableColumnType.Boolean ? false : null;

        return column.Type switch
        {
            CustomTableColumnType.Number or CustomTableColumnType.Currency when value.TryGetDecimal(out var number) => number,
            CustomTableColumnType.Boolean when value.ValueKind is JsonValueKind.True or JsonValueKind.False => value.GetBoolean(),
            CustomTableColumnType.Date when DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", out var date) =>
                date.ToString("dd.MM.yyyy", German),
            _ => value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText(),
        };
    }

    private static string MovementLabel(InventoryTransactionType type) => type switch
    {
        InventoryTransactionType.Delivery => "Lieferung",
        InventoryTransactionType.Sale => "Verkauf",
        InventoryTransactionType.Adjustment => "Korrektur",
        InventoryTransactionType.Return => "Rückgabe",
        InventoryTransactionType.Loss => "Schwund",
        InventoryTransactionType.StockTake => "Inventur",
        _ => type.ToString(),
    };

    private static string TaxAreaLabel(TaxArea area) => area switch
    {
        TaxArea.Ideell => "Ideeller Bereich",
        TaxArea.Zweckbetrieb => "Zweckbetrieb",
        TaxArea.Wirtschaftsbetrieb => "Wirtschaftlicher Geschäftsbetrieb",
        _ => area.ToString(),
    };

    private static string SourceLabel(CashIncomeSource source) => source switch
    {
        CashIncomeSource.Cash => "Bar",
        CashIncomeSource.TallyList => "Strichliste",
        CashIncomeSource.SumUp => "SumUp",
        _ => source.ToString(),
    };

    /// <summary>Dateiname aus einem Titel; doppelte bekommen eine Nummer.</summary>
    private static string UniqueName(string title, HashSet<string> used)
    {
        var name = Slug(title);
        var candidate = name;
        for (var i = 2; !used.Add(candidate); i++) candidate = $"{name}-{i}";
        return candidate;
    }

    private static string Slug(string title)
    {
        var builder = new StringBuilder();
        foreach (var c in title.Trim().ToLowerInvariant()
                     .Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("ß", "ss"))
        {
            if (char.IsAsciiLetterOrDigit(c)) builder.Append(c);
            else if (builder.Length > 0 && builder[^1] != '-') builder.Append('-');
        }
        var slug = builder.ToString().Trim('-');
        return slug.Length == 0 ? "ohne-titel" : slug.Length > 80 ? slug[..80] : slug;
    }

    /// <summary>CSV für Excel: Semikolon, Dezimalkomma, Ja/Nein, CRLF.</summary>
    private sealed class Csv(params string[] headers)
    {
        private readonly StringBuilder _builder = new StringBuilder().Append(Line(headers)).Append("\r\n");

        public void Add(params object?[] values) => _builder.Append(Line(values.Select(Format))).Append("\r\n");

        public override string ToString() => _builder.ToString();

        private static string Format(object? value) => value switch
        {
            null => string.Empty,
            bool b => b ? "Ja" : "Nein",
            decimal d => d.ToString("0.00##", German),
            IFormattable f => f.ToString(null, German),
            _ => value.ToString() ?? string.Empty,
        };

        private static string Line(IEnumerable<string> cells) => string.Join(";", cells.Select(Escape));

        private static string Escape(string text) =>
            text.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? $"\"{text.Replace("\"", "\"\"")}\"" : text;
    }
}
