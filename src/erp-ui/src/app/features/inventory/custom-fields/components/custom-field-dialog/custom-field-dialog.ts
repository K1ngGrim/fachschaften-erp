import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import {
  CustomFieldDto,
  CustomFieldType,
  ItemTypeDto,
} from '../../../../../../../projects/api/src/lib';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatButton } from '@angular/material/button';
import { TitleCasePipe } from '@angular/common';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';

export interface CustomFieldDialogData {
  field?: CustomFieldDto | null;
  itemTypes: ItemTypeDto[];
  mode: 'add' | 'edit' | 'view';
}

@Component({
  selector: 'app-custom-field-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatCheckbox,
    MatButton,
    TitleCasePipe,
    MatChipSet,
    MatChip,
    MatChipRemove,
    MatIcon,
    MatDivider,
  ],
  templateUrl: './custom-field-dialog.html',
  styleUrl: './custom-field-dialog.scss',
})
export class CustomFieldDialog implements OnInit {
  dialogRef = inject(MatDialogRef<CustomFieldDialog, CustomFieldDto>);
  dialogData = inject<CustomFieldDialogData>(MAT_DIALOG_DATA);

  fieldTypes = Object.values(CustomFieldType);
  selectOptions = signal<string[]>(this.dialogData.field?.selectOptions ?? []);
  newOption = new FormControl('');

  isSelect = computed(() => this.form.get('type')?.value === CustomFieldType.Select);
  public readonly isEdit = signal(this.dialogData.mode === 'edit');
  public readonly isView = signal(this.dialogData.mode === 'view');

  form = new FormGroup({
    label: new FormControl(this.dialogData.field?.label ?? '', Validators.required,),
    name: new FormControl(this.dialogData.field?.name ?? '', Validators.required),
    type: new FormControl<CustomFieldType>(
      this.dialogData.field?.type ?? CustomFieldType.Text,
      Validators.required,
    ),
    required: new FormControl(this.dialogData.field?.required ?? false),
    itemTypeIds: new FormControl<string[]>(
      this.dialogData.field?.itemTypes?.map((t: any) => t.id) ?? [],
    ),
  });

  public async ngOnInit() {
    if (this.isView()) {
      this.form.disable();
    }
  }

  toggleTypeId(id: string) {
    const current = this.form.get('itemTypeIds')!.value ?? [];
    this.form
      .get('itemTypeIds')!
      .setValue(current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id]);
  }

  addOption() {
    const opt = this.newOption.value?.trim();
    if (!opt || this.selectOptions().includes(opt)) return;
    this.selectOptions.update((opts) => [...opts, opt]);
    this.newOption.reset();
  }

  removeOption(opt: string) {
    this.selectOptions.update((opts) => opts.filter((o) => o !== opt));
  }

  save() {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.dialogRef.close({
      ...this.dialogData.field,
      name: value.name!.toLowerCase().replace(/\s+/g, '_'),
      label: value.label!,
      type: value.type!,
      required: value.required!,
      selectOptions: this.isSelect() ? this.selectOptions() : [],
      itemTypes: value.itemTypeIds!.map((id) => ({ id })),
    });
  }

  cancel() {
    this.dialogRef.close();
  }
}
