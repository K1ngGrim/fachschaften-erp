import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { DataService } from '../../../shared/services/data.service';
import { PurchaseDialogComponent } from '../purchase-dialog/purchase-dialog.component';
import type { Purchase } from '../../../shared/models';

@Component({
  selector: 'app-purchases-page',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIcon,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderRow,
    MatRow,
    MatHeaderCellDef,
    MatCellDef,
    MatHeaderRowDef,
    MatRowDef,
  ],
  templateUrl: './purchases-page.html',
})
export class PurchasesPage {
  private readonly data = inject(DataService);
  private readonly dialog = inject(MatDialog);

  readonly purchases = this.data.purchases;
  readonly totalExpenses = computed(() =>
    this.data.purchases().reduce((s, p) => s + p.totalPrice, 0),
  );
  readonly displayedColumns = ['date', 'item', 'supplier', 'quantity', 'total', 'unitPrice'];

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  openAdd() {
    const ref = this.dialog.open(PurchaseDialogComponent, { width: '480px', data: {} });
    ref.afterClosed().subscribe((p: Purchase | undefined) => {
      if (p) this.data.addPurchase(p);
    });
  }
}
