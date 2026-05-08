import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatSlideToggle } from '@angular/material/slide-toggle';
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

@Component({
  selector: 'app-item-detail',
  imports: [
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIconButton,
    MatIcon,
    MatChip,
    MatChipSet,
    MatSlideToggle,
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
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
})
export class ItemDetail {
  private readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly product = computed(() => this.data.products().find((p) => p.id === this.id));
  readonly itemType = computed(() =>
    this.data.itemTypes().find((t) => t.id === this.product()?.itemTypeId),
  );
  readonly typeFields = computed(() =>
    this.data
      .customFields()
      .filter((f) => f.active && f.itemTypeIds.includes(this.product()?.itemTypeId ?? '')),
  );
  readonly movements = computed(() =>
    this.data.stockMovements().filter((m) => m.productId === this.id),
  );
  readonly isLowStock = computed(() => {
    const p = this.product();
    return p ? p.trackStock && p.stock <= p.lowStockThreshold : false;
  });

  readonly movementColumns = ['date', 'type', 'quantity', 'reason'];

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  getCustomValueDisplay(fieldName: string, fieldType: string): string {
    const val = this.product()?.customFieldValues[fieldName];
    if (val === undefined || val === null) return '—';
    if (fieldType === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  margin(): string {
    const p = this.product();
    if (!p) return '—';
    const m = p.sellingPrice - p.purchasePrice;
    const pct = p.purchasePrice > 0 ? ((m / p.purchasePrice) * 100).toFixed(0) : 0;
    return `${this.formatCurrency(m)} (${pct}%)`;
  }

  goBack() {
    this.router.navigate(['/items']);
  }
}
