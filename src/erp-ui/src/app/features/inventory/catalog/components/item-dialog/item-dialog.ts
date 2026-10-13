import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatButton } from '@angular/material/button';
import {
  CustomFieldDto,
  CustomFieldType,
  ItemTypeDto,
  ItemTypesService,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { lastValueFrom, map } from 'rxjs';
import { MatDivider } from '@angular/material/list';
import { priceUnit, stockUnit } from '../../../../../shared/models/product-unit';
import { MatCheckbox } from '@angular/material/checkbox';

export interface ItemDialogData {
  product: ProductDto | null;
}

@Component({
  selector: 'app-item-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
    MatHint,
    MatSelect,
    FormsModule,
    MatOption,
    MatInput,
    MatSlideToggle,
    MatDialogActions,
    MatButton,
    MatDivider,
    MatCheckbox,
    ReactiveFormsModule,
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.scss',
})
export class ItemDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ItemDialog, ProductDto>);
  private readonly product = inject<ItemDialogData>(MAT_DIALOG_DATA).product;
  private readonly productController = inject(ProductsService);
  private readonly itemTypesController = inject(ItemTypesService);
  private readonly supplierController = inject(SuppliersService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly isEdit = !!this.product?.id;
  public readonly itemTypes = signal<ItemTypeDto[]>([]);
  public readonly suppliers = signal<SupplierDto[]>([]);
  public readonly typeCustomFields = signal<CustomFieldDto[]>([]);
  public readonly customValues = signal<Record<string, string | number | boolean>>(
    this.product?.customFieldValues ? { ...this.product.customFieldValues } : {},
  );
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);

  public readonly form = new FormGroup({
    name: new FormControl(this.product?.name ?? '', {
      nonNullable: true,
      validators: Validators.required,
    }),
    itemTypeId: new FormControl(this.product?.itemTypeId ?? '', {
      nonNullable: true,
      validators: Validators.required,
    }),
    supplierId: new FormControl<string | null>(this.product?.supplierId ?? null),
    unit: new FormControl(this.product?.unit ?? '', {
      nonNullable: true,
      validators: Validators.maxLength(50),
    }),
    priceUnit: new FormControl(this.product?.priceUnit ?? '', {
      nonNullable: true,
      validators: Validators.maxLength(50),
    }),
    purchasePrice: new FormControl(this.product?.purchasePrice ?? 0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    internalSellingPrice: new FormControl(this.product?.internalSellingPrice ?? 0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    externalSellingPrice: new FormControl(this.product?.externalSellingPrice ?? 0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    // Nur beim Anlegen: danach ändert sich der Bestand über Lager und Lieferungen.
    initialStock: new FormControl(0, { nonNullable: true, validators: Validators.min(0) }),
    lowStockThreshold: new FormControl(this.product?.lowStockThreshold ?? 12, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    trackStock: new FormControl(this.product?.trackStock ?? true, { nonNullable: true }),
  });

  /** Einheiten für die Hinweise an den Preisen, wie sie nach dem Speichern gelten. */
  private readonly units = toSignal(
    this.form.valueChanges.pipe(
      map(() => ({
        unit: this.form.controls.unit.value,
        priceUnit: this.form.controls.priceUnit.value,
      })),
    ),
    { initialValue: { unit: this.product?.unit ?? '', priceUnit: this.product?.priceUnit ?? '' } },
  );
  public readonly stockUnitLabel = computed(() => stockUnit(this.units()));
  public readonly priceUnitLabel = computed(() => priceUnit(this.units()));

  protected readonly CustomFieldType = CustomFieldType;

  async ngOnInit() {
    this.form.controls.itemTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeId) => void this.loadCustomFields(typeId));

    const [itemTypes, suppliers] = await Promise.all([
      lastValueFrom(this.itemTypesController.apiItemTypesGet()),
      lastValueFrom(this.supplierController.apiSuppliersGet()),
    ]);
    this.itemTypes.set(itemTypes);
    this.suppliers.set(suppliers);

    await this.loadCustomFields(this.form.controls.itemTypeId.value);
  }

  public getCustomValue(name: string): string | number | boolean {
    return this.customValues()[name] ?? '';
  }

  public setCustomValue(name: string, value: string | number | boolean) {
    this.customValues.update((values) => ({ ...values, [name]: value }));
  }

  public async save() {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const product: ProductDto = {
      id: this.product?.id ?? null,
      name: value.name.trim(),
      itemTypeId: value.itemTypeId,
      supplierId: value.supplierId,
      purchasePrice: value.purchasePrice,
      internalSellingPrice: value.internalSellingPrice,
      externalSellingPrice: value.externalSellingPrice,
      unit: value.unit.trim() || null,
      priceUnit: value.priceUnit.trim() || null,
      stock: this.isEdit ? (this.product?.stock ?? 0) : value.initialStock,
      lowStockThreshold: value.lowStockThreshold,
      trackStock: value.trackStock,
      customFieldValues: this.customValues(),
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      await lastValueFrom(
        this.productController.apiProductsPost({
          itemUpsertRequestOfProductDto: { id: product.id, value: product },
        }),
      );
      this.dialogRef.close(product);
    } catch {
      this.error.set('Der Artikel konnte nicht gespeichert werden.');
    } finally {
      this.saving.set(false);
    }
  }

  public cancel() {
    this.dialogRef.close();
  }

  private async loadCustomFields(typeId: string) {
    if (!typeId) {
      this.typeCustomFields.set([]);
      return;
    }

    this.typeCustomFields.set(
      await lastValueFrom(this.itemTypesController.apiItemTypesTypeIdCustomFieldsGet({ typeId })),
    );
  }
}
