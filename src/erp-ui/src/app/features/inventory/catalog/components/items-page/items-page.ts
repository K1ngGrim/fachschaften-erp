import { Component, inject, OnInit, signal } from '@angular/core';
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
import {
  ItemTypeDto,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { ItemDialogConfig } from '../../../../../shared/components/base-item-dialog/base-item-dialog';
import { lastValueFrom } from 'rxjs';

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
export class ItemsPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly productsController = inject(ProductsService);
  private readonly supplierController = inject(SuppliersService);

  public columns = signal<GridColumn<ProductDto>[]>([]);
  public products = signal<ProductDto[]>([]);
  private suppliers = signal <SupplierDto[]>([]);

  public async ngOnInit() {
    this.columns.set([
      { key: 'name', label: 'Name' },
      {
        key: 'supplier',
        label: 'Supplier',
        value: (row) => {
          return this.suppliers().find((s) => s.id === row.supplierId)?.name ?? '';
        },
      },
      {
        key: 'purchasePrice',
        label: 'Purchase',
      },
      {
        key: 'stock',
        label: 'Stock',
      },
    ]);

    const suppliers = await lastValueFrom(this.supplierController.apiSuppliersGet());
    this.suppliers.set(suppliers);
    await this.fetchProducts();
  }

  private async fetchProducts() {
    const products = await lastValueFrom(this.productsController.apiProductsGet());
    this.products.set(products);
  }

  isLowStock(p: Product) {
    return p.trackStock && p.stock <= p.lowStockThreshold;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  openAdd() {
    const ref = this.dialog.open(ItemDialog, {
      width: '520px',
      maxHeight: '90vh',
      data: { product: null },
    });
  }

  openEdit(p: Product) {
    const ref = this.dialog.open(ItemDialog, {
      width: '520px',
      maxHeight: '90vh',
      data: { product: p },
    });
  }

  delete(id: string) {}

  public async viewDetail(id: string) {
    await this.router.navigate(['/catalog/item', id]);
  }
}
