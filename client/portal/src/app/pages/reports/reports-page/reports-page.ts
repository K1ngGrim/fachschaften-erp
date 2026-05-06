import { Component, computed, inject } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow, MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef } from '@angular/material/table';
import { DataService } from '../../../shared/services/data.service';

@Component({
  selector: 'app-reports-page',
  imports: [
    MatCard, MatCardContent, MatCardHeader, MatCardTitle,
    MatButton, MatIcon,
    MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow,
    MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef,
  ],
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  readonly data = inject(DataService);

  readonly totalPurchasedUnits = computed(() => this.data.purchases().reduce((s, p) => s + p.quantity, 0));
  readonly totalSoldUnits = computed(() => this.data.sales().reduce((s, sale) => s + sale.items.reduce((si, i) => si + i.quantity, 0), 0));
  readonly totalRevenue = computed(() => this.data.monthlyData().reduce((s, m) => s + m.revenue, 0));
  readonly totalExpenses = computed(() => this.data.monthlyData().reduce((s, m) => s + m.expenses, 0));
  readonly netProfit = computed(() => this.totalRevenue() - this.totalExpenses());

  readonly monthlyColumns = ['month', 'revenue', 'expenses', 'profit'];
  formatCurrency = (v: number) => this.data.formatCurrency(v);

  exportSales() {
    this.downloadCSV('sales.csv', ['Date', 'Seller', 'Items', 'Total'],
      this.data.sales().map(s => [
        s.date, s.seller,
        `"${s.items.map(i => `${i.quantity}x ${i.productName}`).join('; ')}"`,
        s.totalAmount.toFixed(2),
      ])
    );
  }

  exportPurchases() {
    this.downloadCSV('purchases.csv', ['Date', 'Supplier', 'Item', 'Quantity', 'Total'],
      this.data.purchases().map(p => [p.date, p.supplier, p.productName, String(p.quantity), p.totalPrice.toFixed(2)])
    );
  }

  private downloadCSV(filename: string, headers: string[], rows: string[][]) {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
