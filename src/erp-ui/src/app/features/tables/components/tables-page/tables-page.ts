import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import {
  CustomTablesService,
  CustomTableSummaryDto,
  UpsertCustomTableRequest,
} from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { PermissionType } from '../../../../shared/models/permission-type';
import { formatDate } from '../../../../shared/models/finance';
import {
  TableStructureDialog,
  TableStructureDialogData,
} from '../table-structure-dialog/table-structure-dialog';

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

  public readonly tables = signal<CustomTableSummaryDto[]>([]);
  public readonly canDesign = inject(Auth).hasPermission(PermissionType.TableDesignCanWrite);
  public readonly formatDate = formatDate;

  async ngOnInit() {
    this.tables.set(await lastValueFrom(this.tablesController.apiCustomTablesGet()));
  }

  public async create() {
    const request = await lastValueFrom(
      this.dialog
        .open<
          TableStructureDialog,
          TableStructureDialogData,
          UpsertCustomTableRequest
        >(TableStructureDialog, { width: '720px', maxWidth: '95vw', maxHeight: '90vh', data: { table: null } })
        .afterClosed(),
    );
    if (!request) return;

    const table = await lastValueFrom(
      this.tablesController.apiCustomTablesPost({ upsertCustomTableRequest: request }),
    );
    await this.router.navigate(['/tables', table.id]);
  }
}
