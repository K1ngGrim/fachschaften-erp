import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CustomTableColumnType,
  CustomTableDto,
  UpsertCustomTableRequest,
} from '../../../../../../projects/api/src/lib';
import { COLUMN_TYPE_LABELS } from '../../table-values';

export interface TableStructureDialogData {
  table: CustomTableDto | null;
}

/** Bearbeitbare Spalte; Optionen als kommagetrennter Text. */
interface EditableColumn {
  id: string;
  label: string;
  type: CustomTableColumnType;
  required: boolean;
  options: string;
  isNew: boolean;
}

@Component({
  selector: 'app-table-structure-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    FormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatTooltip,
  ],
  templateUrl: './table-structure-dialog.html',
  styleUrl: './table-structure-dialog.scss',
})
export class TableStructureDialog {
  private readonly dialogRef = inject(MatDialogRef<TableStructureDialog, UpsertCustomTableRequest>);
  private readonly table = inject<TableStructureDialogData>(MAT_DIALOG_DATA).table;

  public readonly isNew = !this.table;
  public readonly types = Object.entries(COLUMN_TYPE_LABELS) as [CustomTableColumnType, string][];
  public readonly CustomTableColumnType = CustomTableColumnType;

  public readonly name = signal(this.table?.name ?? '');
  public readonly description = signal(this.table?.description ?? '');
  public readonly columns = signal<EditableColumn[]>(
    this.table?.columns.map((c) => ({
      id: c.id,
      label: c.label,
      type: c.type,
      required: c.required,
      options: (c.options ?? []).join(', '),
      isNew: false,
    })) ?? [this.newColumn()],
  );

  /** Bestehende Spalten, die entfernt wurden: deren Werte gehen verloren. */
  public readonly removedLabels = computed(() => {
    const kept = new Set(this.columns().map((c) => c.id));
    return (this.table?.columns ?? []).filter((c) => !kept.has(c.id)).map((c) => c.label);
  });

  public readonly problem = computed<string | null>(() => {
    if (!this.name().trim()) return 'Die Tabelle braucht einen Namen.';
    if (this.columns().length === 0) return 'Es wird mindestens eine Spalte gebraucht.';
    if (this.columns().some((c) => !c.label.trim())) return 'Jede Spalte braucht einen Namen.';
    if (
      this.columns().some(
        (c) => c.type === CustomTableColumnType.Select && !splitOptions(c.options).length,
      )
    ) {
      return 'Auswahl-Spalten brauchen mindestens eine Option.';
    }
    return null;
  });

  public update(index: number, patch: Partial<EditableColumn>) {
    this.columns.update((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  public add() {
    this.columns.update((cols) => [...cols, this.newColumn()]);
  }

  public remove(index: number) {
    this.columns.update((cols) => cols.filter((_, i) => i !== index));
  }

  public move(index: number, direction: -1 | 1) {
    this.columns.update((cols) => {
      const target = index + direction;
      if (target < 0 || target >= cols.length) return cols;
      const next = [...cols];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  public save() {
    if (this.problem()) return;

    this.dialogRef.close({
      name: this.name().trim(),
      description: this.description().trim() || null,
      columns: this.columns().map((c) => ({
        // Neue Spalten bekommen ihre Id vom Server.
        id: c.isNew ? '' : c.id,
        label: c.label.trim(),
        type: c.type,
        required: c.required,
        options: c.type === CustomTableColumnType.Select ? splitOptions(c.options) : null,
      })),
    });
  }

  public cancel() {
    this.dialogRef.close();
  }

  private newColumn(): EditableColumn {
    return {
      id: crypto.randomUUID(),
      label: '',
      type: CustomTableColumnType.Text,
      required: false,
      options: '',
      isNew: true,
    };
  }
}

function splitOptions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  ];
}
