import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import type { CustomField, Product } from '../../../../../shared/models';
import { MatButton } from '@angular/material/button';
import {
  CustomFieldDto,
  CustomFieldsService,
  CustomFieldType,
  ItemTypeDto,
  ItemTypesService,
  ProductDto,
  ProductsService,
  SupplierDto,
  SuppliersService,
} from '../../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';
import { MatDivider } from '@angular/material/list';
import { MatCheckbox } from '@angular/material/checkbox';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-item-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
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
    TitleCasePipe,
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.scss',
})
export class ItemDialog {
  readonly dialogRef = inject(MatDialogRef<ItemDialog>);
  readonly dialogData = inject<{ product: ProductDto | null }>(MAT_DIALOG_DATA);

  readonly itemTypes = signal<Array<ItemTypeDto>>([]);

  private readonly typesController = inject(ItemTypesService);
  private readonly productController = inject(ProductsService);
  private readonly customFieldsController = inject(CustomFieldsService);
  private readonly supplierController = inject(SuppliersService);

  public readonly selectedTypeId = signal(this.dialogData.product?.itemTypeId ?? '');
  public readonly trackStock = signal(this.dialogData.product?.trackStock ?? true);
  public readonly customValues = signal<Record<string, string | number | boolean>>(
    this.dialogData.product?.customFieldValues
      ? { ...this.dialogData.product.customFieldValues }
      : {},
  );

  public form = new FormGroup({
    name: new FormControl(this.dialogData.product?.name ?? '', Validators.required),
    supplier: new FormControl(
      this.supplierController.apiSuppliersIdGet({
        id: this.dialogData.product?.supplierId ?? '',
      }),
      Validators.required,
    ),
    purchasePrice: new FormControl(this.dialogData.product?.purchasePrice ?? 0, Validators.min(0)),
    sellingPrice: new FormControl(this.dialogData.product?.sellingPrice ?? 0, Validators.min(0)),
    stock: new FormControl(this.dialogData.product?.stock ?? 0, Validators.min(0)),
    threshold: new FormControl(this.dialogData.product?.lowStockThreshold ?? 12, Validators.min(0)),
  });

  public readonly suppliers = signal<SupplierDto[]>([]);
  readonly typeCustomFields = signal<CustomFieldDto[]>([]);
  public readonly isView = signal(false);
  public readonly isEdit = signal(!!this.dialogData.product);

  async ngOnInit() {
    this.itemTypes.set(await lastValueFrom(this.typesController.apiItemTypesGet()));

    this.suppliers.set(
      await lastValueFrom(this.supplierController.apiSuppliersGet()
    ));

    const res = await lastValueFrom(
      this.productController.apiProductsIdCustomFieldsGet({
        id: this.dialogData.product?.id ?? '',
      }),
    );

    this.typeCustomFields.set(res);

    /**if (!this.selectedTypeId() && this.activeTypes().length) {
      this.selectedTypeId.set(this.activeTypes()[0].id);
    }**/
  }

  getCustomValue(name: string): string | number | boolean {
    return this.customValues()[name] ?? '';
  }

  setCustomValue(name: string, value: string | number | boolean) {
    this.customValues.update((v) => ({ ...v, [name]: value }));
  }

  save() {}

  cancel() {
    this.dialogRef.close();
  }

  protected readonly CustomFieldType = CustomFieldType;
}
