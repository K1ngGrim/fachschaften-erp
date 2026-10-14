import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableColumn,
  CustomTableColumnType,
  CustomTableDto,
  CustomTablesService,
  ImportCustomTableRowsRequest,
} from '../../../../../../projects/api/src/lib';
import { COLUMN_TYPE_LABELS, formatValue } from '../../table-values';
import { Vault } from '../../../../core/services/vault';
import { VaultPanel } from '../../../../shared/components/vault-panel/vault-panel';
import {
  convertCell,
  countValues,
  CsvRecord,
  DecimalSeparator,
  decodeCsv,
  DELIMITERS,
  detectDelimiter,
  distinctValues,
  inferColumnType,
  parseBoolean,
  parseCsv,
} from '../../csv';

export interface TableImportDialogData {
  /** Zieltabelle; ohne wird aus der Datei eine neue Tabelle angelegt. */
  table: CustomTableDto | null;
  rowCount?: number;
}

export interface TableImportDialogResult {
  tableId: string;
  imported: number;
  /** Beim Ersetzen entfernte bisherige Einträge. */
  removed: number;
}

/** Spalte der Datei beim Anlegen einer neuen Tabelle. */
interface NewColumn {
  id: string;
  include: boolean;
  label: string;
  type: CustomTableColumnType;
}

/** Zuordnung der Werte einer Spalte der Datei zu Ja/Nein bzw. den Optionen einer Auswahl. */
export interface ValueMapping {
  columnId: string;
  /** Mehr verschiedene Werte, als sich sinnvoll zuordnen lassen. */
  distinct: number;
  entries: { key: string; label: string; count: number; value: unknown }[];
  choices: { value: unknown; label: string }[];
  isBoolean: boolean;
}

interface RowError {
  line: number;
  column: string;
  message: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 50;
const MAX_OPTIONS = 100;
const MAX_MAPPED_VALUES = 50;
const OTHER = 'other';

@Component({
  selector: 'app-table-import-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    FormsModule,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatProgressSpinner,
    NgTemplateOutlet,
    VaultPanel,
  ],
  templateUrl: './table-import-dialog.html',
  styleUrl: './table-import-dialog.scss',
})
export class TableImportDialog {
  private readonly dialogRef = inject(MatDialogRef<TableImportDialog, TableImportDialogResult>);
  private readonly tablesController = inject(CustomTablesService);
  private readonly data = inject<TableImportDialogData>(MAT_DIALOG_DATA);
  protected readonly vault = inject(Vault);

  public readonly table = this.data.table;
  public readonly existingRows = this.data.rowCount ?? 0;
  public readonly isNew = !this.table;
  public readonly delimiters = DELIMITERS;
  public readonly OTHER = OTHER;
  public readonly types = Object.entries(COLUMN_TYPE_LABELS) as [CustomTableColumnType, string][];
  public readonly typeLabel = (type: CustomTableColumnType) => COLUMN_TYPE_LABELS[type];

  public readonly fileName = signal<string | null>(null);
  public readonly fileError = signal<string | null>(null);
  private readonly text = signal('');

  public readonly delimiterChoice = signal<string>(';');
  public readonly customDelimiter = signal('');
  public readonly decimal = signal<DecimalSeparator>(',');
  public readonly hasHeader = signal(true);

  public readonly tableName = signal('');
  public readonly newColumns = signal<NewColumn[]>([]);
  /** Zuordnung Spalten-Id der Tabelle → Spaltennummer der Datei. */
  public readonly mapping = signal<Record<string, number | null>>({});
  /** Von Hand geänderte Werte-Zuordnungen je Spalten-Id und Wert; null = nicht zugeordnet. */
  private readonly valueOverrides = signal<Record<string, Record<string, unknown>>>({});
  public readonly replaceExisting = signal(false);
  /** Neue Tabelle gleich vertraulich anlegen (Einträge werden im Browser verschlüsselt). */
  public readonly confidential = signal(false);
  public readonly skipInvalid = signal(false);

  public readonly saving = signal(false);
  public readonly saveError = signal<string | null>(null);

  public readonly delimiter = computed(() =>
    this.delimiterChoice() === OTHER ? this.customDelimiter().slice(0, 1) : this.delimiterChoice(),
  );

  private readonly records = computed<CsvRecord[]>(() =>
    this.text() && this.delimiter() ? parseCsv(this.text(), this.delimiter()) : [],
  );

  /** Spaltennamen der Datei; ohne Kopfzeile durchnummeriert. */
  public readonly headers = computed<string[]>(() => {
    const records = this.records();
    const count = records.reduce((max, r) => Math.max(max, r.cells.length), 0);
    return Array.from({ length: count }, (_, i) =>
      this.hasHeader() ? records[0]?.cells[i]?.trim() || `Spalte ${i + 1}` : `Spalte ${i + 1}`,
    );
  });

  public readonly dataRecords = computed(() =>
    this.hasHeader() ? this.records().slice(1) : this.records(),
  );

  /** Zielspalten mit der Spalte der Datei, aus der sie befüllt werden. */
  private readonly targets = computed<{ column: CustomTableColumn; source: number | null }[]>(
    () => {
      if (this.table) {
        return this.table.columns.map((column) => ({
          column,
          source: this.mapping()[column.id] ?? null,
        }));
      }
      return this.newColumns()
        .map((c, index) => ({ c, index }))
        .filter(({ c }) => c.include)
        .map(({ c, index }) => ({
          column: {
            id: c.id,
            label: c.label.trim(),
            type: c.type,
            required: false,
            options: c.type === CustomTableColumnType.Select ? this.optionsOf(index) : null,
          },
          source: index,
        }));
    },
  );

  /**
   * Werte-Zuordnung für Ja/Nein-Spalten und (beim Import in eine bestehende Tabelle)
   * Auswahl-Spalten. Vorbelegt mit erkannten Wörtern bzw. gleichnamigen Optionen.
   */
  public readonly valueMappings = computed(() => {
    const result = new Map<string, ValueMapping>();
    const overrides = this.valueOverrides();

    for (const { column, source } of this.targets()) {
      const isBoolean = column.type === CustomTableColumnType.Boolean;
      const isSelect = column.type === CustomTableColumnType.Select && !!this.table;
      if (source === null || (!isBoolean && !isSelect)) continue;

      const counted = countValues(this.dataRecords().map((r) => r.cells[source] ?? ''));
      const options = column.options ?? [];
      const fallback = (key: string) =>
        isBoolean ? parseBoolean(key) : (options.find((o) => o.toLowerCase() === key) ?? null);
      const own = overrides[column.id] ?? {};

      result.set(column.id, {
        columnId: column.id,
        distinct: counted.length,
        isBoolean,
        entries:
          counted.length > MAX_MAPPED_VALUES
            ? []
            : counted.map((e) => ({
                ...e,
                value: e.key in own ? own[e.key] : fallback(e.key),
              })),
        choices: isBoolean
          ? [
              { value: true, label: 'Ja' },
              { value: false, label: 'Nein' },
            ]
          : options.map((o) => ({ value: o, label: o })),
      });
    }
    return result;
  });

  /** Umgewandelte Zeilen und Fehler je Zelle. */
  private readonly converted = computed(() => {
    const targets = this.targets();
    const decimal = this.decimal();
    const valueMaps = new Map(
      [...this.valueMappings().values()].map((m) => [
        m.columnId,
        new Map(m.entries.map((e) => [e.key, e.value])),
      ]),
    );
    const rows: { values: Record<string, unknown>; valid: boolean }[] = [];
    const errors: RowError[] = [];

    for (const record of this.dataRecords()) {
      const values: Record<string, unknown> = {};
      let valid = true;
      for (const { column, source } of targets) {
        const result = convertCell(
          column,
          source === null ? undefined : record.cells[source],
          decimal,
          valueMaps.get(column.id),
        );
        if ('error' in result) {
          valid = false;
          errors.push({ line: record.line, column: column.label, message: result.error });
        } else if (result.value !== undefined) {
          values[column.id] = result.value;
        }
      }
      rows.push({ values, valid });
    }
    return { rows, errors };
  });

  public readonly errors = computed(() => this.converted().errors);
  public readonly invalidRowCount = computed(
    () => this.converted().rows.filter((r) => !r.valid).length,
  );
  private readonly rowsToImport = computed(() =>
    this.converted()
      .rows.filter((r) => r.valid)
      .map((r) => r.values),
  );
  public readonly importCount = computed(() => this.rowsToImport().length);

  public readonly previewColumns = computed(() => this.targets().map((t) => t.column));
  public readonly previewRows = computed(() =>
    this.converted()
      .rows.slice(0, 5)
      .map((row) => this.previewColumns().map((c) => formatValue(c, row.values[c.id]))),
  );

  public readonly problem = computed<string | null>(() => {
    if (!this.text()) return 'Wähle eine CSV-Datei aus.';
    if (!this.delimiter()) return 'Gib ein Trennzeichen an.';
    if (!this.dataRecords().length) return 'Die Datei enthält keine Einträge.';
    if (this.dataRecords().length > MAX_ROWS) {
      return `Es können höchstens ${MAX_ROWS.toLocaleString('de-DE')} Einträge auf einmal importiert werden.`;
    }

    const targets = this.targets();
    if (this.isNew) {
      if (!this.tableName().trim()) return 'Die Tabelle braucht einen Namen.';
      if (!targets.length) return 'Wähle mindestens eine Spalte aus.';
      if (targets.length > MAX_COLUMNS) return `Höchstens ${MAX_COLUMNS} Spalten sind möglich.`;
      if (targets.some((t) => !t.column.label)) return 'Jede Spalte braucht einen Namen.';
      const select = targets.find(
        (t) =>
          t.column.type === CustomTableColumnType.Select &&
          (!t.column.options?.length || t.column.options.length > MAX_OPTIONS),
      );
      if (select) {
        return `„${select.column.label}“ eignet sich nicht als Auswahl: Sie braucht 1 bis ${MAX_OPTIONS} verschiedene Werte.`;
      }
    } else if (targets.every((t) => t.source === null)) {
      return 'Ordne mindestens eine Spalte zu.';
    }

    const tooMany = [...this.valueMappings().values()].find((m) => m.distinct > MAX_MAPPED_VALUES);
    if (tooMany) {
      const label = targets.find((t) => t.column.id === tooMany.columnId)?.column.label;
      return `„${label}“ hat zu viele verschiedene Werte (${tooMany.distinct}) zum Zuordnen. Wähle einen anderen Typ oder eine andere Spalte.`;
    }

    if ((this.confidential() || this.table?.isConfidential) && this.vault.status() !== 'unlocked') {
      return 'Entsperre deinen Tresor, um verschlüsselt zu importieren.';
    }

    if (this.invalidRowCount() && !this.skipInvalid()) {
      return 'Einige Zeilen sind fehlerhaft. Korrigiere die Datei oder überspringe diese Zeilen.';
    }
    if (!this.importCount()) return 'Es bleibt kein gültiger Eintrag zum Importieren.';
    return null;
  });

  public async selectFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.fileError.set(null);
    this.saveError.set(null);
    if (file.size > MAX_FILE_SIZE) {
      this.fileError.set('Die Datei ist zu groß (höchstens 10 MB).');
      return;
    }

    const text = decodeCsv(await file.arrayBuffer());
    this.fileName.set(file.name);
    this.text.set(text);
    this.tableName.set(
      file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim(),
    );

    const delimiter = detectDelimiter(text);
    this.delimiterChoice.set(delimiter);
    this.decimal.set(delimiter === ',' ? '.' : ',');
    this.resetColumns();
  }

  public setDelimiter(choice: string) {
    this.delimiterChoice.set(choice);
    if (choice === ',') this.decimal.set('.');
    if (choice === ';') this.decimal.set(',');
    this.resetColumns();
  }

  public setCustomDelimiter(value: string) {
    this.customDelimiter.set(value);
    this.resetColumns();
  }

  public setDecimal(value: DecimalSeparator) {
    this.decimal.set(value);
    this.resetColumns();
  }

  public setHasHeader(value: boolean) {
    this.hasHeader.set(value);
    this.resetColumns();
  }

  public updateColumn(index: number, patch: Partial<NewColumn>) {
    this.newColumns.update((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  public setMapping(columnId: string, source: number | null) {
    this.mapping.update((m) => ({ ...m, [columnId]: source }));
  }

  public valueMapping(columnId: string): ValueMapping | undefined {
    return this.valueMappings().get(columnId);
  }

  public setValueMapping(columnId: string, key: string, value: unknown) {
    this.valueOverrides.update((all) => ({
      ...all,
      [columnId]: { ...all[columnId], [key]: value },
    }));
  }

  public sourceOf(columnId: string): number | null {
    return this.mapping()[columnId] ?? null;
  }

  /** Erster Wert einer Spalte der Datei als Beispiel. */
  public sample(index: number): string {
    const value = this.dataRecords()
      .map((r) => r.cells[index]?.trim())
      .find(Boolean);
    return value ? (value.length > 40 ? value.slice(0, 40) + '…' : value) : '';
  }

  public async save() {
    if (this.problem() || this.saving()) return;

    this.saving.set(true);
    this.saveError.set(null);
    const rows = this.rowsToImport();
    try {
      if (this.table) {
        const result = await lastValueFrom(
          this.tablesController.apiCustomTablesIdRowsImportPost({
            id: this.table.id,
            importCustomTableRowsRequest: await this.importRequest(this.table, rows),
          }),
        );
        this.dialogRef.close({
          tableId: this.table.id,
          imported: result.imported,
          removed: result.removed,
        });
      } else if (this.confidential()) {
        const tableId = await this.importConfidential(rows);
        this.dialogRef.close({ tableId, imported: rows.length, removed: 0 });
      } else {
        const table = await lastValueFrom(
          this.tablesController.apiCustomTablesImportPost({
            importCustomTableRequest: {
              name: this.tableName().trim(),
              description: null,
              columns: this.targets().map((t) => t.column),
              rows,
            },
          }),
        );
        this.dialogRef.close({ tableId: table.id, imported: rows.length, removed: 0 });
      }
    } catch (error) {
      const detail =
        error instanceof HttpErrorResponse && typeof error.error === 'string' ? error.error : null;
      this.saveError.set(
        detail ? `Der Import wurde abgelehnt: ${detail}` : 'Der Import ist fehlgeschlagen.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  public cancel() {
    this.dialogRef.close();
  }

  /** Bei vertraulichen Tabellen werden die Einträge vor dem Senden verschlüsselt. */
  private async importRequest(
    table: CustomTableDto,
    rows: Record<string, unknown>[],
  ): Promise<ImportCustomTableRowsRequest> {
    const replaceExisting = this.replaceExisting();
    if (!table.isConfidential) return { rows, replaceExisting };
    return {
      rows: [],
      replaceExisting,
      encryptedRows: await Promise.all(rows.map((r) => this.vault.encryptRow(table, r))),
      keyVersion: table.keyVersion,
    };
  }

  /**
   * Neue vertrauliche Tabelle: erst der Aufbau (ohne Einträge), dann verschlüsseln, dann die
   * Einträge verschlüsselt importieren. Klartext erreicht den Server so nie. Schlägt ein
   * Schritt fehl, wird die angefangene Tabelle wieder gelöscht.
   */
  private async importConfidential(rows: Record<string, unknown>[]): Promise<string> {
    const created = await lastValueFrom(
      this.tablesController.apiCustomTablesPost({
        upsertCustomTableRequest: {
          name: this.tableName().trim(),
          description: null,
          columns: this.targets().map((t) => t.column),
        },
      }),
    );
    try {
      await this.vault.makeConfidential(created.id, []);
      const table = await lastValueFrom(
        this.tablesController.apiCustomTablesIdGet({ id: created.id }),
      );
      await lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsImportPost({
          id: table.id,
          importCustomTableRowsRequest: await this.importRequest(table, rows),
        }),
      );
      return table.id;
    } catch (error) {
      await lastValueFrom(this.tablesController.apiCustomTablesIdDelete({ id: created.id })).catch(
        () => undefined,
      );
      throw error;
    }
  }

  /** Spalten neu aus der Datei ableiten: Typen vorschlagen bzw. nach Namen zuordnen. */
  private resetColumns() {
    this.valueOverrides.set({});
    const headers = this.headers();
    const records = this.dataRecords();

    if (this.table) {
      const byName = new Map(headers.map((h, i) => [normalize(h), i] as const));
      this.mapping.set(
        Object.fromEntries(
          this.table.columns.map((c) => [c.id, byName.get(normalize(c.label)) ?? null]),
        ),
      );
      return;
    }

    this.newColumns.set(
      headers.map((label, index) => ({
        id: 'c' + crypto.randomUUID().replace(/-/g, '').slice(0, 10),
        include: true,
        label,
        type: inferColumnType(
          records.map((r) => r.cells[index] ?? ''),
          this.decimal(),
        ),
      })),
    );
  }

  private optionsOf(index: number): string[] {
    return distinctValues(this.dataRecords().map((r) => r.cells[index] ?? ''));
  }
}

function normalize(label: string): string {
  return label.trim().toLowerCase();
}
