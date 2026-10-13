using System.Globalization;
using System.Text.Json;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Models.Generic;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Controller;

/// <summary>
/// Eigene Tabellen: Struktur anlegen erfordert tabledesign.canwrite, Einträge pflegen
/// tables.canwrite, ansehen tables.canread.
/// </summary>
[ApiController]
[Route("/api/custom-tables")]
public class CustomTablesController(CoreContext db) : ControllerBase
{
    private const int MaxColumns = 50;
    private const int MaxOptions = 100;

    [RequirePermission(PermissionType.TablesRead)]
    [HttpGet]
    public async Task<ActionResult<IList<CustomTableSummaryDto>>> GetAll()
    {
        var tables = await db.CustomTables
            .Where(t => t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Description,
                t.Columns,
                RowCount = t.Rows.Count(r => r.IsActive),
                UpdatedAt = t.Modified ?? t.Created,
            })
            .ToListAsync();

        return Ok(tables
            .Select(t => new CustomTableSummaryDto(t.Id, t.Name, t.Description, t.Columns.Count, t.RowCount, t.UpdatedAt))
            .ToList());
    }

    [RequirePermission(PermissionType.TablesRead)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomTableDto>> Get(Guid id)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        return table is null ? NotFound() : Ok(ToDto(table));
    }

    [RequirePermission(PermissionType.TableDesignWrite)]
    [HttpPost]
    public async Task<ActionResult<CustomTableDto>> Create(UpsertCustomTableRequest request)
    {
        var (columns, error) = NormalizeColumns(request);
        if (error is not null) return BadRequest(error);

        var table = new CustomTableEntity
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Columns = columns!,
            CreatorId = ((Invoker)User).UserId,
            Created = DateTimeOffset.UtcNow,
            IsActive = true,
        };

        db.CustomTables.Add(table);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = table.Id }, ToDto(table));
    }

    /// <summary>Ändert Name und Spalten. Werte entfernter Spalten werden beim nächsten Speichern einer Zeile verworfen.</summary>
    [RequirePermission(PermissionType.TableDesignWrite)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomTableDto>> Update(Guid id, UpsertCustomTableRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();

        var (columns, error) = NormalizeColumns(request);
        if (error is not null) return BadRequest(error);

        table.Name = request.Name.Trim();
        table.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        table.Columns = columns!;
        table.ModifierId = ((Invoker)User).UserId;
        table.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Ok(ToDto(table));
    }

    [RequirePermission(PermissionType.TableDesignWrite)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();

        table.IsActive = false;
        table.ModifierId = ((Invoker)User).UserId;
        table.Modified = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return NoContent();
    }

    [RequirePermission(PermissionType.TablesRead)]
    [HttpGet("{id:guid}/rows")]
    public async Task<ActionResult<IList<CustomTableRowDto>>> GetRows(Guid id)
    {
        if (!await db.CustomTables.AnyAsync(t => t.Id == id && t.IsActive)) return NotFound();

        var rows = await db.CustomTableRows
            .Where(r => r.TableId == id && r.IsActive)
            .OrderBy(r => r.Created)
            .ToListAsync();

        var names = await UserNamesAsync(rows.Select(r => r.ModifierId ?? r.CreatorId));
        return Ok(rows.Select(r => ToRowDto(r, names)).ToList());
    }

    [RequirePermission(PermissionType.TablesWrite)]
    [HttpPost("{id:guid}/rows")]
    public async Task<ActionResult<CustomTableRowDto>> CreateRow(Guid id, UpsertCustomTableRowRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();

        var (values, error) = NormalizeValues(table.Columns, request.Values);
        if (error is not null) return BadRequest(error);

        var row = new CustomTableRowEntity
        {
            Id = Guid.NewGuid(),
            TableId = table.Id,
            Values = values!,
            CreatorId = ((Invoker)User).UserId,
            Created = DateTimeOffset.UtcNow,
            IsActive = true,
        };
        db.CustomTableRows.Add(row);
        await db.SaveChangesAsync();

        return Ok(ToRowDto(row, await UserNamesAsync([row.CreatorId])));
    }

    [RequirePermission(PermissionType.TablesWrite)]
    [HttpPut("{id:guid}/rows/{rowId:guid}")]
    public async Task<ActionResult<CustomTableRowDto>> UpdateRow(Guid id, Guid rowId, UpsertCustomTableRowRequest request)
    {
        var table = await db.CustomTables.FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
        if (table is null) return NotFound();

        var row = await db.CustomTableRows.FirstOrDefaultAsync(r => r.Id == rowId && r.TableId == id && r.IsActive);
        if (row is null) return NotFound();

        var (values, error) = NormalizeValues(table.Columns, request.Values);
        if (error is not null) return BadRequest(error);

        row.Values = values!;
        row.ModifierId = ((Invoker)User).UserId;
        row.Modified = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        return Ok(ToRowDto(row, await UserNamesAsync([row.ModifierId.Value])));
    }

    [RequirePermission(PermissionType.TablesWrite)]
    [HttpDelete("{id:guid}/rows/{rowId:guid}")]
    public async Task<IActionResult> DeleteRow(Guid id, Guid rowId)
    {
        var row = await db.CustomTableRows.FirstOrDefaultAsync(r => r.Id == rowId && r.TableId == id && r.IsActive);
        if (row is null) return NotFound();

        row.IsActive = false;
        row.ModifierId = ((Invoker)User).UserId;
        row.Modified = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Prüft die Struktur und vergibt neuen Spalten eine Id.</summary>
    private static (List<CustomTableColumn>? Columns, string? Error) NormalizeColumns(UpsertCustomTableRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return (null, "Name is required.");
        if (request.Name.Trim().Length > 100) return (null, "Name is too long.");
        if (request.Description?.Trim().Length > 500) return (null, "Description is too long.");
        if (request.Columns is not { Count: > 0 }) return (null, "At least one column is required.");
        if (request.Columns.Count > MaxColumns) return (null, $"At most {MaxColumns} columns are allowed.");

        var result = new List<CustomTableColumn>();
        foreach (var column in request.Columns)
        {
            if (string.IsNullOrWhiteSpace(column.Label)) return (null, "Every column needs a label.");
            if (column.Label.Trim().Length > 100) return (null, "Column label is too long.");
            if (!Enum.IsDefined(column.Type)) return (null, "Unknown column type.");

            IList<string>? options = null;
            if (column.Type == CustomTableColumnType.Select)
            {
                options = (column.Options ?? [])
                    .Select(o => o.Trim())
                    .Where(o => o.Length > 0)
                    .Distinct()
                    .ToList();
                if (options.Count == 0) return (null, $"Column '{column.Label}' needs at least one option.");
                if (options.Count > MaxOptions || options.Any(o => o.Length > 100))
                    return (null, $"Column '{column.Label}' has too many or too long options.");
            }

            var id = string.IsNullOrWhiteSpace(column.Id) ? "c" + Guid.NewGuid().ToString("N")[..10] : column.Id.Trim();
            if (id.Length > 40 || result.Any(c => c.Id == id)) return (null, "Column ids must be unique.");

            result.Add(new CustomTableColumn(id, column.Label.Trim(), column.Type, column.Required, options));
        }

        return (result, null);
    }

    /// <summary>Prüft die Werte gegen die Spalten; unbekannte Schlüssel werden verworfen.</summary>
    private static (JsonDocument? Values, string? Error) NormalizeValues(
        IList<CustomTableColumn> columns,
        JsonElement input)
    {
        if (input.ValueKind != JsonValueKind.Object) return (null, "Values must be an object.");

        var result = new Dictionary<string, object>();
        foreach (var column in columns)
        {
            var present = input.TryGetProperty(column.Id, out var value) &&
                          value.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined) &&
                          !(value.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(value.GetString()));

            if (!present)
            {
                if (column.Required && column.Type != CustomTableColumnType.Boolean)
                    return (null, $"'{column.Label}' is required.");
                continue;
            }

            switch (column.Type)
            {
                case CustomTableColumnType.Text or CustomTableColumnType.LongText:
                    if (value.ValueKind != JsonValueKind.String) return (null, $"'{column.Label}' must be text.");
                    var text = value.GetString()!.Trim();
                    var max = column.Type == CustomTableColumnType.Text ? 1_000 : 20_000;
                    if (text.Length > max) return (null, $"'{column.Label}' is too long.");
                    result[column.Id] = text;
                    break;

                case CustomTableColumnType.Number or CustomTableColumnType.Currency:
                    if (value.ValueKind != JsonValueKind.Number || !value.TryGetDecimal(out var number))
                        return (null, $"'{column.Label}' must be a number.");
                    result[column.Id] = column.Type == CustomTableColumnType.Currency
                        ? Math.Round(number, 2, MidpointRounding.AwayFromZero)
                        : number;
                    break;

                case CustomTableColumnType.Date:
                    if (value.ValueKind != JsonValueKind.String ||
                        !DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                            DateTimeStyles.None, out var date))
                        return (null, $"'{column.Label}' must be a date (yyyy-MM-dd).");
                    result[column.Id] = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    break;

                case CustomTableColumnType.Boolean:
                    if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                        return (null, $"'{column.Label}' must be yes or no.");
                    result[column.Id] = value.GetBoolean();
                    break;

                case CustomTableColumnType.Select:
                    if (value.ValueKind != JsonValueKind.String || column.Options?.Contains(value.GetString()!) != true)
                        return (null, $"'{column.Label}' has an invalid option.");
                    result[column.Id] = value.GetString()!;
                    break;
            }
        }

        return (JsonSerializer.SerializeToDocument(result), null);
    }

    private static CustomTableDto ToDto(CustomTableEntity table) =>
        new(table.Id, table.Name, table.Description, table.Columns);

    private static CustomTableRowDto ToRowDto(CustomTableRowEntity row, Dictionary<Guid, string> names) =>
        new(row.Id, row.Values.RootElement.Clone(), row.Created, row.Modified ?? row.Created,
            names.GetValueOrDefault(row.ModifierId ?? row.CreatorId));

    private async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return await db.Users
            .Where(u => distinct.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.UserName ?? string.Empty);
    }
}

public record CustomTableSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    int ColumnCount,
    int RowCount,
    DateTimeOffset UpdatedAt);

public record CustomTableDto(Guid Id, string Name, string? Description, IList<CustomTableColumn> Columns);

/// <param name="Columns">Spalten in Anzeigereihenfolge; neue Spalten ohne Id bekommen eine.</param>
public record UpsertCustomTableRequest(string Name, string? Description, IList<CustomTableColumn> Columns);

/// <param name="Values">Objekt mit Werten je Spalten-Id.</param>
public record CustomTableRowDto(
    Guid Id,
    JsonElement Values,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? UpdatedBy);

public record UpsertCustomTableRowRequest(JsonElement Values);
