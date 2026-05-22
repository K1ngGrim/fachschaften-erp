import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-base-item-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatButton,
    MatDialogActions,
  ],
  templateUrl: './base-item-dialog.html',
  styleUrl: './base-item-dialog.scss',
})
export class BaseItemDialog<T extends Record<string, any>> {
  readonly dialogRef = inject(MatDialogRef<BaseItemDialog<T>>);

  config = inject<ItemDialogConfig<T>>(MAT_DIALOG_DATA);

  form = new FormGroup(
    Object.fromEntries(
      this.config.fields.map((f) => [
        f.key,
        new FormControl(this.config.data?.[f.key] ?? null, f.required ? Validators.required : []),
      ]),
    ),
  );

  save() {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value as Partial<T>);
  }

  asText(f: DialogField) {
    return f as TextDialogField;
  }
  asNumber(f: DialogField) {
    return f as NumberDialogField;
  }
  asSelect(f: DialogField) {
    return f as SelectDialogField;
  }

  protected cancel() {
    this.dialogRef.close();
  }
}

// dialog-field.ts
export interface BaseDialogField {
  label: string;
  key: string;
  required?: boolean;
  cssClasses?: string;
}

export interface TextDialogField extends BaseDialogField {
  type: 'text';
  placeholder?: string;
}

export interface NumberDialogField extends BaseDialogField {
  type: 'number';
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface DateDialogField extends BaseDialogField {
  type: 'date';
}

export interface SelectDialogField<T = any> extends BaseDialogField {
  type: 'select';
  options: { label: string; value: T }[];
}

export interface BooleanDialogField extends BaseDialogField {
  type: 'boolean';
}

export type DialogField<T = any> =
  | TextDialogField
  | NumberDialogField
  | DateDialogField
  | BooleanDialogField
  | SelectDialogField<T>;

export interface ItemDialogConfig<T> {
  title: string;
  fields: DialogField[];
  data?: Partial<T> | null;
  readonly?: boolean;
}
