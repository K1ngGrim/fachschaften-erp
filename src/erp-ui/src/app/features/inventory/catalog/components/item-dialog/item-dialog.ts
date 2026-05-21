import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import type { Product } from '../../../../../shared/models';
import { MatButton } from '@angular/material/button';
import {
  CustomFieldsService,
  ItemTypeDto,
  ItemTypesService,
} from '../../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';

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
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.scss',
})
export class ItemDialog {
  readonly dialogRef = inject(MatDialogRef<ItemDialog>);
  readonly dialogData = inject<{ product: Product | null }>(MAT_DIALOG_DATA);

  readonly itemTypes = signal<Array<ItemTypeDto>>([]);

  private readonly typesController = inject(ItemTypesService);
  private readonly customFieldsController = inject(CustomFieldsService);

  readonly isEdit = !!this.dialogData.product;

  public readonly selectedTypeId = signal(this.dialogData.product?.itemTypeId ?? '');
  public readonly trackStock = signal(this.dialogData.product?.trackStock ?? true);
  public readonly customValues = signal<Record<string, string | number | boolean>>(
    this.dialogData.product?.customFieldValues
      ? { ...this.dialogData.product.customFieldValues }
      : {},
  );

  public name = signal(this.dialogData.product?.name ?? '');
  public supplier = signal(this.dialogData.product?.supplier ?? '');
  public purchasePrice = signal(this.dialogData.product?.purchasePrice ?? 0);
  public sellingPrice = signal(this.dialogData.product?.sellingPrice ?? 0);
  public stock = signal(this.dialogData.product?.stock ?? 0);
  public threshold = signal(this.dialogData.product?.lowStockThreshold ?? 12);

  //TODO refactor to backend controller (custom fields)
  /**readonly typeCustomFields = computed<CustomField[]>(() =>

    this.customFieldsController.apiCustomFieldsTypeTypeIdGet()

    this.data
      .customFields()
      .filter((f) => f.active && f.itemTypeIds.includes(this.selectedTypeId())),
  );**/

  async ngOnInit() {
    this.itemTypes.set(await lastValueFrom(this.typesController.apiItemTypesGet()));
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
}
