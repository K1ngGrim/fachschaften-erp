import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  DataGrid,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';

import { lastValueFrom } from 'rxjs';
import {
  StockOverviewDto,
  StockService,
  StockUpdateRequest,
} from '../../../../../../../projects/api/src/lib';
import { formatCurrency } from '../../../../../shared/models/finance';
import {
  StockUpdateDialog,
  StockUpdateDialogData,
} from '../stock-update-dialog/stock-update-dialog';

@Component({
  selector: 'app-warehouse-page',
  imports: [DataGrid, MatButton, MatIcon, PageHeader],
  templateUrl: './warehouse-page.html',
  styleUrl: './warehouse-page.scss',
})
export class WarehousePage {
  public stockTemplate = viewChild<TemplateRef<any>>('stockTemplate');

  public readonly stockController = inject(StockService);
  private readonly dialog = inject(MatDialog);

  public readonly columns = signal<GridColumn<StockOverviewDto>[]>([]);
  public rows = signal<StockOverviewDto[]>([]);

  public async ngOnInit() {
    this.columns.set([
      { key: 'name', label: 'Artikel' },
      { key: 'unit', label: 'Einheit' },
      { key: 'stock', label: 'Bestand', cellTemplate: this.stockTemplate() },
      { key: 'purchasePrice', label: 'EK', align: 'end', value: (row) => formatCurrency(row.purchasePrice) },
      {
        key: 'sellingPriceInternal',
        label: 'VK Mitglieder',
        align: 'end',
        value: (row) => formatCurrency(row.sellingPriceInternal),
      },
      {
        key: 'sellingPriceExternal',
        label: 'VK Gäste',
        align: 'end',
        value: (row) => formatCurrency(row.sellingPriceExternal),
      },
    ]);
    await this.fetchItems();
  }

  public async openStockUpdate() {
    const request = await lastValueFrom(
      this.dialog
        .open(StockUpdateDialog, {
          width: '960px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { stock: this.rows() } satisfies StockUpdateDialogData,
        })
        .afterClosed(),
    );

    if (!request) return;

    const stock = await lastValueFrom(
      this.stockController.apiStockUpdatePost({
        stockUpdateRequest: request as StockUpdateRequest,
      }),
    );

    this.rows.set(stock);
  }

  private async fetchItems() {
    const rows = await lastValueFrom(this.stockController.apiStockGet());
    this.rows.set(rows);
  }
}
