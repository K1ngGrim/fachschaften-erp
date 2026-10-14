import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { CustomTableColumn, CustomTableColumnType } from '../../../../../../projects/api/src/lib';

/** Formular aus den Feldern einer Vorlage; Werte je Feld-Id wie in data.json. */
@Component({
  selector: 'app-fields-form',
  imports: [FormsModule, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatCheckbox],
  template: `
    <div class="d-flex flex-column gap-3">
      @for (field of fields(); track field.id) {
        @switch (field.type) {
          @case (Type.Boolean) {
            <mat-checkbox
              [checked]="!!values()[field.id]"
              [disabled]="disabled()"
              (change)="set(field, $event.checked)"
            >
              {{ field.label }}
            </mat-checkbox>
          }
          @case (Type.Select) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <mat-select
                [ngModel]="values()[field.id] ?? null"
                (ngModelChange)="set(field, $event)"
                [required]="field.required"
                [disabled]="disabled()"
              >
                @if (!field.required) {
                  <mat-option [value]="null">–</mat-option>
                }
                @for (option of field.options ?? []; track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
          @case (Type.LongText) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <textarea
                matInput
                rows="4"
                [ngModel]="values()[field.id] ?? ''"
                (ngModelChange)="set(field, $event)"
                [required]="field.required"
                [disabled]="disabled()"
              ></textarea>
            </mat-form-field>
          }
          @default {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label
                >{{ field.label }}{{ field.type === Type.Currency ? ' (€)' : '' }}</mat-label
              >
              <input
                matInput
                [type]="inputType(field)"
                [step]="field.type === Type.Currency ? '0.01' : 'any'"
                [ngModel]="values()[field.id] ?? ''"
                (ngModelChange)="set(field, $event)"
                [required]="field.required"
                [disabled]="disabled()"
              />
            </mat-form-field>
          }
        }
      } @empty {
        <p class="text-hint small mb-0">Diese Vorlage hat keine Felder.</p>
      }
    </div>
  `,
})
export class FieldsForm {
  public readonly fields = input.required<CustomTableColumn[]>();
  public readonly values = model.required<Record<string, unknown>>();
  public readonly disabled = input(false);

  protected readonly Type = CustomTableColumnType;

  protected inputType(field: CustomTableColumn): string {
    switch (field.type) {
      case CustomTableColumnType.Number:
      case CustomTableColumnType.Currency:
        return 'number';
      case CustomTableColumnType.Date:
        return 'date';
      default:
        return 'text';
    }
  }

  /** Leere Eingaben entfernen, Zahlen als Zahl speichern. */
  protected set(field: CustomTableColumn, raw: unknown) {
    let value: unknown = raw;
    if (raw === '' || raw === null || raw === undefined) value = undefined;
    else if (
      field.type === CustomTableColumnType.Number ||
      field.type === CustomTableColumnType.Currency
    ) {
      const number = Number(raw);
      value = Number.isFinite(number) ? number : undefined;
    }

    this.values.update((current) => {
      const next = { ...current };
      if (value === undefined) delete next[field.id];
      else next[field.id] = value;
      return next;
    });
  }
}

/** Pflichtfelder ohne Wert (Ja/Nein zählt immer als ausgefüllt). */
export function missingRequired(
  fields: CustomTableColumn[],
  values: Record<string, unknown>,
): string[] {
  return fields
    .filter(
      (f) =>
        f.required &&
        f.type !== CustomTableColumnType.Boolean &&
        (values[f.id] === undefined || values[f.id] === ''),
    )
    .map((f) => f.label);
}
