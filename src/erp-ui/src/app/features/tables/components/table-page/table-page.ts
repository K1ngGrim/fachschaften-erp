import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableDto,
  CustomTableRowDto,
  CustomTablesService,
  UpsertCustomTableRequest,
} from '../../../../../../projects/api/src/lib';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../shared/components/data-grid/data-grid';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { DialogService } from '../../../../core/services/dialog-service';
import { PermissionType } from '../../../../shared/models/permission-type';
import { downloadText, toFileName } from '../../../../shared/models/download';
import { formatValue } from '../../table-values';
import { CsvFormat, EXCEL_FORMAT, STANDARD_FORMAT, toCsv } from '../../csv';
import {
  TableStructureDialog,
  TableStructureDialogData,
} from '../table-structure-dialog/table-structure-dialog';
import { TableRowDialog, TableRowDialogData } from '../table-row-dialog/table-row-dialog';
import {
  TableImportDialog,
  TableImportDialogData,
  TableImportDialogResult,
} from '../table-import-dialog/table-import-dialog';

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
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  public readonly table = signal<CustomTableDto | null>(null);
  public readonly rows = signal<CustomTableRowDto[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly notice = signal<string | null>(null);
  public readonly EXCEL_FORMAT = EXCEL_FORMAT;
  public readonly STANDARD_FORMAT = STANDARD_FORMAT;

  public readonly canWrite = this.auth.hasPermission(PermissionType.TablesCanWrite);
  public readonly canDesign = this.auth.hasPermission(PermissionType.TableDesignCanWrite);

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
    await this.run(() =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsPost({
          id: this.id,
          upsertCustomTableRowRequest: { values },
        }),
      ),
    );
  }

  public async editRow(row: CustomTableRowDto) {
    const values = await this.openRowDialog(row.values ?? {});
    if (!values) return;
    await this.run(() =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdRowsRowIdPut({
          id: this.id,
          rowId: row.id,
          upsertCustomTableRowRequest: { values },
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
    const request = await lastValueFrom(
      this.dialog
        .open<
          TableStructureDialog,
          TableStructureDialogData,
          UpsertCustomTableRequest
        >(TableStructureDialog, { width: '720px', maxWidth: '95vw', maxHeight: '90vh', data: { table: this.table() } })
        .afterClosed(),
    );
    if (!request) return;
    await this.run(() =>
      lastValueFrom(
        this.tablesController.apiCustomTablesIdPut({
          id: this.id,
          upsertCustomTableRequest: request,
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
    } catch {
      this.error.set('Die Änderung konnte nicht gespeichert werden.');
    }
    await this.load();
  }

  private async load() {
    const [table, rows] = await Promise.all([
      lastValueFrom(this.tablesController.apiCustomTablesIdGet({ id: this.id })),
      lastValueFrom(this.tablesController.apiCustomTablesIdRowsGet({ id: this.id })),
    ]).catch(() => [null, []] as const);
    this.table.set(table);
    this.rows.set([...rows]);
  }
}
