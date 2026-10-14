import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableDto,
  CustomTableRowDto,
  CustomTablesService,
  UpsertCustomTableRowRequest,
} from '../../../../../../projects/api/src/lib';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../shared/components/data-grid/data-grid';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { DialogService } from '../../../../core/services/dialog-service';
import { PlainRow, Vault } from '../../../../core/services/vault';
import { VaultPanel } from '../../../../shared/components/vault-panel/vault-panel';
import { PermissionType } from '../../../../shared/models/permission-type';
import { downloadText, toFileName } from '../../../../shared/models/download';
import { formatValue } from '../../table-values';
import { CsvFormat, EXCEL_FORMAT, STANDARD_FORMAT, toCsv } from '../../csv';
import {
  TableStructureDialog,
  TableStructureDialogData,
  TableStructureResult,
} from '../table-structure-dialog/table-structure-dialog';
import { TableRowDialog, TableRowDialogData } from '../table-row-dialog/table-row-dialog';
import {
  TableImportDialog,
  TableImportDialogData,
  TableImportDialogResult,
} from '../table-import-dialog/table-import-dialog';
import {
  TableAccessDialog,
  TableAccessDialogData,
} from '../table-access-dialog/table-access-dialog';
import {
  TableConfidentialDialog,
  TableConfidentialDialogData,
} from '../table-confidential-dialog/table-confidential-dialog';

/**
 * plain: normale Tabelle; locked: vertraulich, Tresor fehlt oder ist gesperrt;
 * no-access: keine Freigabe für den eigenen Tresor; ready: entschlüsselt.
 */
type AccessState = 'plain' | 'locked' | 'no-access' | 'ready';

/** Zeile für das Grid: formatierte Texte je Spalte (durchsuchbar) plus Original. */
type GridRow = Record<string, string> & { __row: CustomTableRowDto };

@Component({
  selector: 'app-table-page',
  imports: [
    RouterLink,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    DataGrid,
    GridActionCellDirective,
    PageHeader,
    VaultPanel,
  ],
  templateUrl: './table-page.html',
  styleUrl: './table-page.scss',
})
export class TablePage implements OnInit {
  private readonly tablesController = inject(CustomTablesService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly vault = inject(Vault);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  public readonly table = signal<CustomTableDto | null>(null);
  public readonly rows = signal<CustomTableRowDto[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly notice = signal<string | null>(null);
  /** Einträge, die sich nicht entschlüsseln ließen (vertrauliche Tabellen). */
  public readonly undecryptable = signal(0);
  public readonly EXCEL_FORMAT = EXCEL_FORMAT;
  public readonly STANDARD_FORMAT = STANDARD_FORMAT;

  public readonly canWrite = this.auth.hasPermission(PermissionType.TablesCanWrite);
  public readonly canDesign = this.auth.hasPermission(PermissionType.TableDesignCanWrite);

  public readonly access = computed<AccessState>(() => {
    const table = this.table();
    if (!table?.isConfidential) return 'plain';
    if (this.vault.status() !== 'unlocked') return 'locked';
    return table.wrappedKey ? 'ready' : 'no-access';
  });
  public readonly canSeeRows = computed(() => ['plain', 'ready'].includes(this.access()));

  public readonly columns = computed<GridColumn<GridRow>[]>(() =>
    (this.table()?.columns ?? []).map((c) => ({ key: c.id, label: c.label })),
  );

  public readonly gridRows = computed<GridRow[]>(() => {
    const columns = this.table()?.columns ?? [];
    return this.rows().map((row) => {
      const values = (row.values ?? {}) as Record<string, unknown>;
      const entry = { __row: row } as GridRow;
      for (const column of columns) entry[column.id] = formatValue(column, values[column.id]);
      return entry;
    });
  });

  async ngOnInit() {
    try {
      await this.load();
    } finally {
      this.loading.set(false);
    }
  }

  public async addRow() {
    const values = await this.openRowDialog(null);
    if (!values) return;
    await this.run(async () =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsPost({
          id: this.id,
          upsertCustomTableRowRequest: await this.rowRequest(values),
        }),
      ),
    );
  }

  public async editRow(row: CustomTableRowDto) {
    const values = await this.openRowDialog(row.values ?? {});
    if (!values) return;
    await this.run(async () =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsRowIdPut({
          id: this.id,
          rowId: row.id,
          upsertCustomTableRowRequest: await this.rowRequest(values),
        }),
      ),
    );
  }

  public async deleteRow(row: CustomTableRowDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Eintrag löschen',
      message: 'Diesen Eintrag löschen?',
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;
    await this.run(() =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsRowIdDelete({ id: this.id, rowId: row.id }),
      ),
    );
  }

  public async editStructure() {
    const result = await lastValueFrom(
      this.dialog
        .open<
          TableStructureDialog,
          TableStructureDialogData,
          TableStructureResult
        >(TableStructureDialog, { width: '720px', maxWidth: '95vw', maxHeight: '90vh', data: { table: this.table() } })
        .afterClosed(),
    );
    if (!result) return;
    await this.run(() =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdPut({
          id: this.id,
          upsertCustomTableRequest: result.request,
        }),
      ),
    );
  }

  public async deleteTable() {
    const table = this.table();
    if (!table) return;

    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Tabelle löschen',
      message: `„${table.name}“ mit allen ${this.rows().length} Einträgen löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;

    await lastValueFrom(this.tablesController.apiCustomTablesIdDelete({ id: this.id }));
    await this.router.navigate(['/tables']);
  }

  public downloadCsv(format: CsvFormat) {
    const table = this.table();
    if (!table) return;
    const csv = toCsv(
      table.columns,
      this.rows().map((r) => (r.values ?? {}) as Record<string, unknown>),
      format,
    );
    downloadText(toFileName(table.name, 'csv'), csv, 'text/csv');
  }

  public async importCsv() {
    const table = this.table();
    if (!table) return;

    const result = await lastValueFrom(
      this.dialog
        .open<TableImportDialog, TableImportDialogData, TableImportDialogResult>(
          TableImportDialog,
          {
            width: '760px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            data: { table, rowCount: this.rows().length },
          },
        )
        .afterClosed(),
    );
    if (!result) return;

    this.error.set(null);
    const imported =
      result.imported === 1 ? '1 Eintrag importiert' : `${result.imported} Einträge importiert`;
    this.notice.set(
      result.removed ? `${imported}, ${result.removed} bisherige entfernt.` : `${imported}.`,
    );
    await this.load();
  }

  /** Nach dem Entsperren des Tresors: Einträge laden und entschlüsseln. */
  public async reload() {
    this.loading.set(true);
    try {
      await this.load();
    } finally {
      this.loading.set(false);
    }
  }

  public async makeConfidential() {
    const table = this.table();
    if (!table) return;
    const done = await lastValueFrom(
      this.dialog
        .open<
          TableConfidentialDialog,
          TableConfidentialDialogData,
          boolean
        >(TableConfidentialDialog, { width: '560px', maxWidth: '95vw', data: { table, rows: this.plainRows() } })
        .afterClosed(),
    );
    if (!done) return;
    this.notice.set('Die Tabelle ist jetzt vertraulich.');
    await this.load();
  }

  public async manageAccess() {
    const table = this.table();
    if (!table) return;
    const changed = await lastValueFrom(
      this.dialog
        .open<TableAccessDialog, TableAccessDialogData, boolean>(TableAccessDialog, {
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: {
            table,
            rows: this.plainRows(),
            complete: this.undecryptable() === 0,
          },
        })
        .afterClosed(),
    );
    if (changed) await this.load();
  }

  private plainRows(): PlainRow[] {
    return this.rows().map((r) => ({
      id: r.id,
      values: (r.values ?? {}) as Record<string, unknown>,
    }));
  }

  /** Werte im Klartext oder, bei vertraulichen Tabellen, verschlüsselt. */
  private async rowRequest(values: Record<string, unknown>): Promise<UpsertCustomTableRowRequest> {
    const table = this.table()!;
    if (!table.isConfidential) return { values };
    return {
      values: {},
      encryptedValues: await this.vault.encryptRow(table, values),
      keyVersion: table.keyVersion,
    };
  }

  private openRowDialog(values: Record<string, unknown> | null) {
    const table = this.table()!;
    return lastValueFrom(
      this.dialog
        .open<TableRowDialog, TableRowDialogData, Record<string, unknown>>(TableRowDialog, {
          width: '520px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { tableName: table.name, columns: table.columns, values },
        })
        .afterClosed(),
    );
  }

  private async run(action: () => Promise<unknown>) {
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Der Schlüssel der Tabelle wurde inzwischen gewechselt. Die Tabelle ist neu geladen, bitte noch einmal versuchen.'
          : 'Die Änderung konnte nicht gespeichert werden.',
      );
    }
    await this.load();
  }

  private async load() {
    const table = await lastValueFrom(
      this.tablesController.apiCustomTablesIdGet({ id: this.id }),
    ).catch(() => null);
    this.table.set(table);
    this.undecryptable.set(0);
    if (!table) {
      this.rows.set([]);
      return;
    }

    if (table.isConfidential) {
      await this.vault.load().catch(() => undefined);
      if (this.vault.status() !== 'unlocked' || !table.wrappedKey) {
        this.rows.set([]);
        return;
      }
    }

    const rows = await lastValueFrom(
      this.tablesController.apiCustomTablesIdRowsGet({ id: this.id }),
    ).catch(() => [] as CustomTableRowDto[]);
    if (!table.isConfidential) {
      this.rows.set([...rows]);
      return;
    }

    this.rows.set(await this.decryptRows(table, rows));
    // Fehlt dem Wiederherstellungs-Tresor der Schlüssel, ergänzen wir ihn nebenbei.
    void this.vault.ensureRecoveryKey(table).catch(() => undefined);
  }

  private async decryptRows(table: CustomTableDto, rows: CustomTableRowDto[]) {
    const decrypted = await Promise.all(
      rows.map(async (row) => {
        try {
          return { ...row, values: await this.vault.decryptRow(table, row.encryptedValues ?? '') };
        } catch {
          return null;
        }
      }),
    );
    this.undecryptable.set(decrypted.filter((r) => r === null).length);
    return decrypted.filter((r): r is NonNullable<typeof r> => r !== null);
  }
}
