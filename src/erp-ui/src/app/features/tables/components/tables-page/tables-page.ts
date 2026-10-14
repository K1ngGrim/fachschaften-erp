import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import { CustomTablesService, CustomTableSummaryDto } from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { PermissionType } from '../../../../shared/models/permission-type';
import { formatDate } from '../../../../shared/models/finance';
import {
  TableStructureDialog,
  TableStructureDialogData,
  TableStructureResult,
} from '../table-structure-dialog/table-structure-dialog';
import { Vault } from '../../../../core/services/vault';
import {
  TableImportDialog,
  TableImportDialogData,
  TableImportDialogResult,
} from '../table-import-dialog/table-import-dialog';

@Component({
  selector: 'app-tables-page',
  imports: [RouterLink, MatCard, MatCardContent, MatButton, MatIcon, PageHeader],
  templateUrl: './tables-page.html',
  styleUrl: './tables-page.scss',
})
export class TablesPage implements OnInit {
  private readonly tablesController = inject(CustomTablesService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly vault = inject(Vault);

  public readonly tables = signal<CustomTableSummaryDto[]>([]);
  public readonly error = signal<string | null>(null);
  private readonly auth = inject(Auth);
  public readonly canDesign = this.auth.hasPermission(PermissionType.TableDesignCanWrite);
  /** Eine Tabelle aus CSV braucht auch das Recht, Einträge anzulegen. */
  public readonly canImport =
    this.canDesign && this.auth.hasPermission(PermissionType.TablesCanWrite);
  public readonly formatDate = formatDate;

  async ngOnInit() {
    this.tables.set(await lastValueFrom(this.tablesController.apiCustomTablesGet()));
  }

  public async create() {
    const result = await lastValueFrom(
      this.dialog
        .open<
          TableStructureDialog,
          TableStructureDialogData,
          TableStructureResult
        >(TableStructureDialog, { width: '720px', maxWidth: '95vw', maxHeight: '90vh', data: { table: null } })
        .afterClosed(),
    );
    if (!result) return;

    const table = await lastValueFrom(
      this.tablesController.apiCustomTablesPost({ upsertCustomTableRequest: result.request }),
    );
    if (result.confidential) {
      try {
        await this.vault.makeConfidential(table.id, []);
      } catch {
        // Lieber keine Tabelle als eine, die unbemerkt unverschlüsselt bleibt.
        await lastValueFrom(this.tablesController.apiCustomTablesIdDelete({ id: table.id }));
        this.error.set('Die vertrauliche Tabelle konnte nicht angelegt werden.');
        return;
      }
    }
    await this.router.navigate(['/tables', table.id]);
  }

  public async importCsv() {
    const result = await lastValueFrom(
      this.dialog
        .open<
          TableImportDialog,
          TableImportDialogData,
          TableImportDialogResult
        >(TableImportDialog, { width: '760px', maxWidth: '95vw', maxHeight: '90vh', data: { table: null } })
        .afterClosed(),
    );
    if (result) await this.router.navigate(['/tables', result.tableId]);
  }
}
