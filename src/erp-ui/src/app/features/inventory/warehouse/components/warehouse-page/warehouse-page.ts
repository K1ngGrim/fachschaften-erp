import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';

import { lastValueFrom } from 'rxjs';
import { NgClass } from '@angular/common';
import { StockOverviewDto, StockService } from '../../../../../../../projects/api/src/lib';

@Component({
  selector: 'app-warehouse-page',
  imports: [
    DataGrid,
    MatButton,
    MatIcon,
    MatIconButton,
    MatChip,
    MatChipSet,
    MatTooltip,
    PageHeader,
    NgClass,
  ],
  templateUrl: './warehouse-page.html',
  styleUrl: './warehouse-page.scss',
})
export class WarehousePage {
  public stockTemplate = viewChild<TemplateRef<any>>('stockTemplate');

  public readonly stockController = inject(StockService);

  public readonly columns = signal<GridColumn<StockOverviewDto>[]>([]);
  public rows = signal<StockOverviewDto[]>([]);

  public async ngOnInit() {
    this.columns.set([
      { key: 'name', label: 'Artikel' },
      { key: 'unit', label: 'Einheit' },
      { key: 'stock', label: 'Bestand', cellTemplate: this.stockTemplate() },
      { key: 'purchasePrice', label: 'EK' },
      { key: 'sellingPriceInternal', label: 'VK Mitglieder' },
      { key: 'sellingPriceExternal', label: 'VK Gäste' },
    ]);
    await this.fetchItems();
  }

  private async fetchItems() {
    const rows = await lastValueFrom(this.stockController.apiStockGet());
    this.rows.set(rows);
  }
}
