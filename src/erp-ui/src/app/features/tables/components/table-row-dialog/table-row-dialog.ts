import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { CustomTableColumn, CustomTableColumnType } from '../../../../../../projects/api/src/lib';

export interface TableRowDialogData {
  tableName: string;
  columns: CustomTableColumn[];
  values: Record<string, unknown> | null;
}

@Component({
  selector: 'app-table-row-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    FormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
  ],
  templateUrl: './table-row-dialog.html',
})
export class TableRowDialog {
  private readonly dialogRef = inject(MatDialogRef<TableRowDialog, Record<string, unknown>>);
  public readonly data = inject<TableRowDialogData>(MAT_DIALOG_DATA);
  public readonly CustomTableColumnType = CustomTableColumnType;

  public readonly values = signal<Record<string, unknown>>({ ...(this.data.values ?? {}) });

  public readonly missing = computed(() =>
    this.data.columns
      .filter((c) => c.required && c.type !== CustomTableColumnType.Boolean)
      .filter((c) => isEmpty(this.values()[c.id]))
      .map((c) => c.label),
  );

  public get(columnId: string): unknown {
    return this.values()[columnId] ?? null;
  }

  public set(column: CustomTableColumn, value: unknown) {
    let next = value;
    if (
      column.type === CustomTableColumnType.Number ||
      column.type === CustomTableColumnType.Currency
    ) {
      next = value === '' || value === null || value === undefined ? null : Number(value);
    }
    this.values.update((v) => ({ ...v, [column.id]: next }));
  }

  public save() {
    if (this.missing().length) return;

    // Leere Werte nicht mitschicken; Ja/Nein immer als true/false.
    const result: Record<string, unknown> = {};
    for (const column of this.data.columns) {
      const value = this.values()[column.id];
      if (column.type === CustomTableColumnType.Boolean) result[column.id] = !!value;
      else if (!isEmpty(value)) result[column.id] = value;
    }
    this.dialogRef.close(result);
  }

  public cancel() {
    this.dialogRef.close();
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim()) ||
    (typeof value === 'number' && Number.isNaN(value))
  );
}
