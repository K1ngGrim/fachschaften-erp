import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import {
  DeliveryDto,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { EMPTY_GUID } from '../../../../../shared/models/guid';

export interface DeliveryDialogData {
  delivery: DeliveryDto | null;
}

interface PositionRow {
  key: number;
  productId: string;
  quantity: number;
  unitPurchasePrice: number;
}

@Component({
  selector: 'app-delivery-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatOption,
    MatSelect,
    MatTooltip,
  ],
  templateUrl: './delivery-dialog.html',
  styleUrl: './delivery-dialog.scss',
})
export class DeliveryDialog {
  private readonly dialogRef = inject(MatDialogRef<DeliveryDialog>);
  private readonly data = inject<DeliveryDialogData>(MAT_DIALOG_DATA);
  private readonly supplierController = inject(SuppliersService);
  private readonly productController = inject(ProductsService);

  public readonly isEdit = this.data.delivery !== null;

  public readonly suppliers = signal<SupplierDto[]>([]);
  public readonly products = signal<ProductDto[]>([]);

  public readonly supplierId = signal<string>(this.data.delivery?.supplierId ?? '');
  public readonly deliveryDate = signal<string>(
    (this.data.delivery?.deliveryDate ?? new Date().toISOString()).substring(0, 10),
  );
  public readonly documentNumber = signal<string>(this.data.delivery?.documentNumber ?? '');
  public readonly receiptUrl = signal<string>(this.data.delivery?.receiptUrl ?? '');
  public readonly note = signal<string>(this.data.delivery?.note ?? '');

  private nextKey = 0;
  public readonly positions = signal<PositionRow[]>(
    (this.data.delivery?.positions ?? []).map((position) => ({
      key: this.nextKey++,
      productId: position.productId,
      quantity: position.quantity,
      unitPurchasePrice: position.unitPurchasePrice,
    })),
  );

  public readonly total = computed(() =>
    this.positions().reduce((sum, row) => sum + row.quantity * row.unitPurchasePrice, 0),
  );

  public readonly isValid = computed(
    () =>
      this.supplierId() !== '' &&
      this.positions().length > 0 &&
      this.positions().every((row) => row.productId !== '' && row.quantity !== 0),
  );

  public async ngOnInit() {
    const [suppliers, products] = await Promise.all([
      lastValueFrom(this.supplierController.apiSuppliersGet()),
      lastValueFrom(this.productController.apiProductsGet()),
    ]);

    this.suppliers.set(suppliers);
    this.products.set(products);

    if (this.positions().length === 0) this.addPosition();
  }

  public addPosition() {
    this.positions.update((rows) => [
      ...rows,
      { key: this.nextKey++, productId: '', quantity: 1, unitPurchasePrice: 0 },
    ]);
  }

  public removePosition(key: number) {
    this.positions.update((rows) => rows.filter((row) => row.key !== key));
  }

  public setProduct(key: number, productId: string) {
    const product = this.products().find((entry) => entry.id === productId);
    this.patchPosition(key, {
      productId,
      unitPurchasePrice: product?.purchasePrice ?? 0,
    });
  }

  public setQuantity(key: number, value: unknown) {
    this.patchPosition(key, { quantity: this.toNumber(value) });
  }

  public setPrice(key: number, value: unknown) {
    this.patchPosition(key, { unitPurchasePrice: this.toNumber(value) });
  }

  private patchPosition(key: number, patch: Partial<PositionRow>) {
    this.positions.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  public formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  public save() {
    if (!this.isValid()) return;

    const delivery: DeliveryDto = {
      id: this.data.delivery?.id ?? EMPTY_GUID,
      supplierId: this.supplierId(),
      deliveryDate: new Date(this.deliveryDate()).toISOString(),
      documentNumber: this.documentNumber().trim() || null,
      receiptUrl: this.receiptUrl().trim() || null,
      note: this.note().trim() || null,
      positions: this.positions().map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        unitPurchasePrice: row.unitPurchasePrice,
      })),
    };

    this.dialogRef.close(delivery);
  }

  public cancel() {
    this.dialogRef.close();
  }
}
