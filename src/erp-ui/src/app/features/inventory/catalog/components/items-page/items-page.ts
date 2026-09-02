import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { ItemDialog } from '../item-dialog/item-dialog';
import {
  ItemTypeDto,
  ItemTypesService,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { formatCurrency } from '../../../../../shared/models/finance';

@Component({
  selector: 'app-items-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
  ],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPage {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly productController = inject(ProductsService);
  private readonly supplierController = inject(SuppliersService);
  private readonly itemTypeController = inject(ItemTypesService);

  public readonly typeTemplate = viewChild<TemplateRef<any>>('typeTemplate');

  public readonly columns = signal<GridColumn<ProductDto>[]>([]);
  public readonly products = signal<ProductDto[]>([]);

  private readonly suppliers = signal<SupplierDto[]>([]);
  private readonly itemTypes = signal<ItemTypeDto[]>([]);

  public async ngOnInit() {
    this.columns.set([
      { key: 'name', label: 'Name' },
      {
        key: 'itemTypeId',
        label: 'Typ',
        width: '10rem',
        cellTemplate: this.typeTemplate(),
        value: (row) => this.itemTypes().find((t) => t.id === row.itemTypeId)?.name ?? '—',
      },
      {
        key: 'purchasePrice',
        label: 'EK',
        align: 'end',
        width: '8rem',
        value: (row) => formatCurrency(row.purchasePrice),
      },
      {
        key: 'internalSellingPrice',
        label: 'VK Mitglieder',
        align: 'end',
        width: '9rem',
        value: (row) => formatCurrency(row.internalSellingPrice),
      },
      {
        key: 'externalSellingPrice',
        label: 'VK Gäste',
        align: 'end',
        width: '9rem',
        value: (row) => formatCurrency(row.externalSellingPrice),
      },
      {
        key: 'supplierId',
        label: 'Lieferant',
        value: (row) => this.suppliers().find((s) => s.id === row.supplierId)?.name ?? '—',
      },
    ]);

    const [suppliers, itemTypes] = await Promise.all([
      lastValueFrom(this.supplierController.apiSuppliersGet()),
      lastValueFrom(this.itemTypeController.apiItemTypesGet()),
    ]);

    this.suppliers.set(suppliers);
    this.itemTypes.set(itemTypes);

    await this.fetchProducts();
  }

  private async fetchProducts() {
    const products = await lastValueFrom(this.productController.apiProductsGet());
    this.products.set(products);
  }

  public openAdd() {
    this.dialog.open(ItemDialog, {
      width: '520px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { product: null },
    });
  }

  public openEdit(product: ProductDto) {
    this.dialog.open(ItemDialog, {
      width: '520px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { product },
    });
  }

  public delete(id: string) {}

  public async viewDetail(id: string) {
    await this.router.navigate(['/catalog/item', id]);
  }
}
