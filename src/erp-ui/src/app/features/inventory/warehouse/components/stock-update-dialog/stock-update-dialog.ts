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
import { MatFormField, MatInput, MatLabel, MatPrefix } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import {
  InventoryTransactionType,
  StockOverviewDto,
  StockUpdateRequest,
} from '../../../../../../../projects/api/src/lib';

export interface StockUpdateDialogData {
  stock: StockOverviewDto[];
}

interface StockUpdateRow {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  newStock: number;
  type: InventoryTransactionType;
}

@Component({
  selector: 'app-stock-update-dialog',
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
    MatPrefix,
    MatOption,
    MatSelect,
    MatTooltip,
  ],
  templateUrl: './stock-update-dialog.html',
  styleUrl: './stock-update-dialog.scss',
})
export class StockUpdateDialog {
  private readonly dialogRef = inject(MatDialogRef<StockUpdateDialog>);
  private readonly data = inject<StockUpdateDialogData>(MAT_DIALOG_DATA);

  public readonly search = signal('');
  public readonly note = signal('');

  public readonly rows = signal<StockUpdateRow[]>(
    this.data.stock.map((entry) => ({
      productId: entry.productId,
      name: entry.name,
      unit: entry.unit,
      currentStock: entry.stock,
      newStock: entry.stock,
      type: InventoryTransactionType.Sale,
    })),
  );

  public readonly types = signal<{ value: InventoryTransactionType; label: string }[]>([
    { value: InventoryTransactionType.Sale, label: 'Verkauf' },
    { value: InventoryTransactionType.Delivery, label: 'Lieferung' },
    { value: InventoryTransactionType.Adjustment, label: 'Korrektur' },
    { value: InventoryTransactionType.Return, label: 'Rückgabe' },
    { value: InventoryTransactionType.Loss, label: 'Schwund' },
  ]);

  public readonly visibleRows = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.rows();
    return this.rows().filter((row) => row.name.toLowerCase().includes(query));
  });

  public readonly changedRows = computed(() =>
    this.rows().filter((row) => row.newStock !== row.currentStock),
  );

  public difference(row: StockUpdateRow): number {
    return row.newStock - row.currentStock;
  }

  public setNewStock(productId: string, value: unknown) {
    const parsed = Number(value);
    this.patchRow(productId, { newStock: Number.isFinite(parsed) ? parsed : 0 });
  }

  public setType(productId: string, type: InventoryTransactionType) {
    this.patchRow(productId, { type });
  }

  public resetRow(productId: string) {
    const row = this.rows().find((entry) => entry.productId === productId);
    if (!row) return;
    this.patchRow(productId, { newStock: row.currentStock });
  }

  private patchRow(productId: string, patch: Partial<StockUpdateRow>) {
    this.rows.update((rows) =>
      rows.map((row) => (row.productId === productId ? { ...row, ...patch } : row)),
    );
  }

  public save() {
    const changed = this.changedRows();
    if (changed.length === 0) return;

    const request: StockUpdateRequest = {
      note: this.note().trim() || null,
      positions: changed.map((row) => ({
        productId: row.productId,
        newStock: row.newStock,
        type: row.type,
        note: null,
      })),
    };

    this.dialogRef.close(request);
  }

  public cancel() {
    this.dialogRef.close();
  }
}
