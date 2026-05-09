import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { DataService } from '../../../shared/services/data.service';
import type { CustomField, Product } from '../../../shared/models';

@Component({
  selector: 'app-item-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
    MatSlideToggle,
    MatCheckbox,
    MatDivider,
  ],
  templateUrl: './item-dialog.component.html',
})
export class ItemDialogComponent implements OnInit {
  private readonly data = inject(DataService);
  readonly dialogRef = inject(MatDialogRef<ItemDialogComponent>);
  readonly dialogData = inject<{ product: Product | null }>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.dialogData.product;
  readonly activeTypes = computed(() => this.data.itemTypes().filter((t) => t.active));

  selectedTypeId = signal(this.dialogData.product?.itemTypeId ?? '');
  trackStock = signal(this.dialogData.product?.trackStock ?? true);
  customValues = signal<Record<string, string | number | boolean>>(
    this.dialogData.product?.customFieldValues
      ? { ...this.dialogData.product.customFieldValues }
      : {},
  );

  name = this.dialogData.product?.name ?? '';
  supplier = this.dialogData.product?.supplier ?? '';
  purchasePrice = this.dialogData.product?.purchasePrice ?? 0;
  sellingPrice = this.dialogData.product?.sellingPrice ?? 0;
  stock = this.dialogData.product?.stock ?? 0;
  threshold = this.dialogData.product?.lowStockThreshold ?? 12;

  readonly typeCustomFields = computed<CustomField[]>(() =>
    this.data
      .customFields()
      .filter((f) => f.active && f.itemTypeIds.includes(this.selectedTypeId())),
  );

  ngOnInit() {
    if (!this.selectedTypeId() && this.activeTypes().length) {
      this.selectedTypeId.set(this.activeTypes()[0].id);
    }
  }

  getCustomValue(name: string): string | number | boolean {
    return this.customValues()[name] ?? '';
  }

  setCustomValue(name: string, value: string | number | boolean) {
    this.customValues.update((v) => ({ ...v, [name]: value }));
  }

  save() {
    const product: Product = {
      id: this.dialogData.product?.id ?? crypto.randomUUID(),
      name: this.name,
      itemTypeId: this.selectedTypeId(),
      purchasePrice: Number(this.purchasePrice),
      sellingPrice: Number(this.sellingPrice),
      stock: Number(this.stock),
      supplier: this.supplier,
      lowStockThreshold: Number(this.threshold),
      trackStock: this.trackStock(),
      customFieldValues: this.customValues(),
    };
    this.dialogRef.close(product);
  }

  cancel() {
    this.dialogRef.close();
  }
}
