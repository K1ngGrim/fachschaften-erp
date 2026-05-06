import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader } from '@angular/material/card';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow, MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef } from '@angular/material/table';
import { DataService } from '../../../shared/services/data.service';
import { ItemDialogComponent } from '../item-dialog/item-dialog.component';
import type { Product } from '../../../shared/models';

@Component({
  selector: 'app-items-page',
  imports: [
    FormsModule,
    MatCard, MatCardContent, MatCardHeader,
    MatFormField, MatLabel, MatSuffix,
    MatInput,
    MatSelect, MatOption,
    MatButton, MatIconButton,
    MatIcon,
    MatChip, MatChipSet,
    MatTooltip,
    MatTable, MatColumnDef, MatHeaderCell, MatCell, MatHeaderRow, MatRow,
    MatHeaderCellDef, MatCellDef, MatHeaderRowDef, MatRowDef,
  ],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPage {
  private readonly data = inject(DataService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly search = signal('');
  readonly typeFilter = signal('all');

  readonly itemTypes = this.data.itemTypes;
  readonly activeTypes = computed(() => this.data.itemTypes().filter(t => t.active));

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const type = this.typeFilter();
    return this.data.products().filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q);
      const matchesType = type === 'all' || p.itemTypeId === type;
      return matchesSearch && matchesType;
    });
  });

  readonly displayedColumns = ['name', 'type', 'purchasePrice', 'sellingPrice', 'stock', 'value', 'supplier', 'actions'];

  formatCurrency = (v: number) => this.data.formatCurrency(v);

  getType(itemTypeId: string) {
    return this.itemTypes().find(t => t.id === itemTypeId);
  }

  isLowStock(p: Product) {
    return p.trackStock && p.stock <= p.lowStockThreshold;
  }

  openAdd() {
    const ref = this.dialog.open(ItemDialogComponent, { width: '520px', maxHeight: '90vh', data: { product: null } });
    ref.afterClosed().subscribe((p: Product | undefined) => { if (p) this.data.addProduct(p); });
  }

  openEdit(p: Product) {
    const ref = this.dialog.open(ItemDialogComponent, { width: '520px', maxHeight: '90vh', data: { product: p } });
    ref.afterClosed().subscribe((updated: Product | undefined) => { if (updated) this.data.updateProduct(updated); });
  }

  deleteProduct(id: string) {
    this.data.deleteProduct(id);
  }

  viewDetail(id: string) {
    this.router.navigate(['/items', id]);
  }
}
