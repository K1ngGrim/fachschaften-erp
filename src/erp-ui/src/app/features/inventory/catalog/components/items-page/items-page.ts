import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DataService } from '../../../../../shared/services/data.service';
import type { Product } from '../../../../../shared/models';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatTooltip } from '@angular/material/tooltip';
import { ItemDialog } from '../item-dialog/item-dialog';

@Component({
  selector: 'app-items-page',
  imports: [
    FormsModule,
    MatIcon,
    PageHeader,
    DataGrid,
    GridActionCellDirective,
    MatIconButton,
    MatTooltip,
    MatButton,
  ],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPage {
  protected readonly data = inject(DataService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  columns: GridColumn<Product>[] = [
    { key: 'name', label: 'Name' },
    { key: 'supplier', label: 'Supplier' },
    {
      key: 'purchasePrice',
      label: 'Purchase',
    },
    {
      key: 'stock',
      label: 'Stock',
    },
  ];

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  isLowStock(p: Product) {
    return p.trackStock && p.stock <= p.lowStockThreshold;
  }

  openAdd() {
    const ref = this.dialog.open(ItemDialog, {
      width: '520px',
      maxHeight: '90vh',
      data: { product: null },
    });
    ref.afterClosed().subscribe((p: Product | undefined) => {
      if (p) this.data.addProduct(p);
    });
  }

  openEdit(p: Product) {
    const ref = this.dialog.open(ItemDialog, {
      width: '520px',
      maxHeight: '90vh',
      data: { product: p },
    });
    ref.afterClosed().subscribe((updated: Product | undefined) => {
      if (updated) this.data.updateProduct(updated);
    });
  }

  delete(id: string) {
    this.data.deleteProduct(id);
  }

  public async viewDetail(id: string) {
    await this.router.navigate(['/catalog/item', id]);
  }
}
