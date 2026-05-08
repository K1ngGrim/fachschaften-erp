import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DataService } from '../../../shared/services/data.service';
import type { CustomField, FieldType } from '../../../shared/models';

@Component({
  selector: 'app-custom-field-dialog',
  imports: [
    FormsModule,
    TitleCasePipe,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
    MatCheckbox,
    MatChip,
    MatChipSet,
    MatIcon,
    MatDivider,
  ],
  templateUrl: './custom-field-dialog.component.html',
})
export class CustomFieldDialogComponent {
  private readonly data = inject(DataService);
  readonly dialogRef = inject(MatDialogRef<CustomFieldDialogComponent>);
  readonly dialogData = inject<{ field: CustomField | null }>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.dialogData.field;
  readonly activeTypes = computed(() => this.data.itemTypes().filter((t) => t.active));
  readonly fieldTypes: FieldType[] = ['text', 'number', 'boolean', 'select', 'date'];

  label = this.dialogData.field?.label ?? '';
  name = this.dialogData.field?.name ?? '';
  fieldType = signal<FieldType>(this.dialogData.field?.type ?? 'text');
  required = this.dialogData.field?.required ?? false;
  selectedTypeIds = signal<string[]>(this.dialogData.field?.itemTypeIds ?? []);
  selectOptions = signal<string[]>(this.dialogData.field?.options ?? []);
  newOption = '';

  toggleTypeId(id: string) {
    this.selectedTypeIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  addOption() {
    const opt = this.newOption.trim();
    if (opt && !this.selectOptions().includes(opt)) {
      this.selectOptions.update((opts) => [...opts, opt]);
      this.newOption = '';
    }
  }

  removeOption(opt: string) {
    this.selectOptions.update((opts) => opts.filter((o) => o !== opt));
  }

  save() {
    const field: CustomField = {
      id: this.dialogData.field?.id ?? crypto.randomUUID(),
      name: this.name.toLowerCase().replace(/\s+/g, '_'),
      label: this.label,
      type: this.fieldType(),
      required: this.required,
      active: this.dialogData.field?.active ?? true,
      itemTypeIds: this.selectedTypeIds(),
      options: this.fieldType() === 'select' ? this.selectOptions() : undefined,
      order: this.dialogData.field?.order ?? this.data.customFields().length,
    };
    this.dialogRef.close(field);
  }

  cancel() {
    this.dialogRef.close();
  }
}
