import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton } from '@angular/material/button';
import { DataService } from '../../../shared/services/data.service';
import type { Purchase } from '../../../shared/models';

@Component({
  selector: 'app-purchase-dialog',
  imports: [
    FormsModule,
    MatDialogTitle, MatDialogContent, MatDialogActions,
    MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatButton,
  ],
  templateUrl: './purchase-dialog.component.html',
})
export class PurchaseDialogComponent {
  private readonly data = inject(DataService);
  readonly dialogRef = inject(MatDialogRef<PurchaseDialogComponent>);

  readonly products = this.data.products;

  date = new Date().toISOString().split('T')[0];
  supplier = '';
  selectedProductId = '';
  quantity = 1;
  totalPrice = 0;

  get selectedProduct() {
    return this.products().find(p => p.id === this.selectedProductId);
  }

  onProductChange() {
    const p = this.selectedProduct;
    if (p) {
      this.supplier = p.supplier;
      this.totalPrice = +(p.purchasePrice * this.quantity).toFixed(2);
    }
  }

  onQuantityChange() {
    const p = this.selectedProduct;
    if (p) this.totalPrice = +(p.purchasePrice * this.quantity).toFixed(2);
  }

  save() {
    const p = this.selectedProduct;
    if (!p) return;
    const purchase: Purchase = {
      id: crypto.randomUUID(),
      date: this.date,
      supplier: this.supplier,
      productId: p.id,
      productName: p.name,
      quantity: Number(this.quantity),
      totalPrice: Number(this.totalPrice),
    };
    this.dialogRef.close(purchase);
  }

  cancel() { this.dialogRef.close(); }
}
