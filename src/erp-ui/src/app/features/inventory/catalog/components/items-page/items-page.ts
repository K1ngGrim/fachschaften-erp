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
import { ItemDialog, ItemDialogData } from '../item-dialog/item-dialog';
import { DialogService } from '../../../../../core/services/dialog-service';
import {
  ItemTypeDto,
  ItemTypesService,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { formatCurrency } from '../../../../../shared/models/finance';
import {
  hasSeparatePriceUnit,
  priceUnit,
  priceUnitsPerStockUnit,
  stockUnit,
} from '../../../../../shared/models/product-unit';

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
  private readonly dialogService = inject(DialogService);
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
        filterType: 'select',
        cellTemplate: this.typeTemplate(),
        value: (row) => this.itemTypes().find((t) => t.id === row.itemTypeId)?.name ?? '—',
      },
      {
        key: 'unit',
        label: 'Einheit',
        width: '11rem',
        filterType: 'select',
        value: (row) =>
          hasSeparatePriceUnit(row)
            ? `${stockUnit(row)} à ${priceUnitsPerStockUnit(row).toLocaleString('de-DE')} ${priceUnit(row)}`
            : stockUnit(row),
      },
      {
        key: 'purchasePrice',
        label: 'EK',
        align: 'end',
        width: '8rem',
        value: (row) => formatCurrency(row.purchasePrice) + perPriceUnit(row),
      },
      {
        key: 'internalSellingPrice',
        label: 'VK Mitglieder',
        align: 'end',
        width: '9rem',
        value: (row) => formatCurrency(row.internalSellingPrice) + perPriceUnit(row),
      },
      {
        key: 'externalSellingPrice',
        label: 'VK Gäste',
        align: 'end',
        width: '9rem',
        value: (row) => formatCurrency(row.externalSellingPrice) + perPriceUnit(row),
      },
      {
        key: 'supplierId',
        label: 'Lieferant',
        filterType: 'select',
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

  public async openAdd() {
    await this.openDialog(null);
  }

  public async openEdit(product: ProductDto) {
    await this.openDialog(product);
  }

  public async delete(product: ProductDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Artikel löschen',
      message: `„${product.name}“ löschen? Buchungen und Lagerbewegungen bleiben erhalten.`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed || !product.id) return;

    await lastValueFrom(this.productController.apiProductsIdDelete({ id: product.id }));
    await this.fetchProducts();
  }

  private async openDialog(product: ProductDto | null) {
    const saved = await lastValueFrom(
      this.dialog
        .open(ItemDialog, {
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: { product } satisfies ItemDialogData,
        })
        .afterClosed(),
    );
    if (saved) await this.fetchProducts();
  }

  public async viewDetail(id: string) {
    await this.router.navigate(['/catalog/item', id]);
  }
}

/** Hängt die Preiseinheit an Preise an, wenn sie von der Bestandseinheit abweicht. */
function perPriceUnit(row: ProductDto): string {
  return hasSeparatePriceUnit(row) ? ` / ${priceUnit(row)}` : '';
}
