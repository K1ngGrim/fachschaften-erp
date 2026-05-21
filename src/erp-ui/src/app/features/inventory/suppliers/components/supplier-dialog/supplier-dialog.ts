import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SupplierDto } from '../../../../../../../projects/api/src/lib';
import { DialogMode } from '../../../../administration/users/components/user-dialog/user-dialog';

export interface SupplierDialogData {
  mode: DialogMode;
  supplier?: SupplierDto;
}

@Component({
  selector: 'app-supplier-dialog',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './supplier-dialog.html',
  styleUrl: './supplier-dialog.scss',
})
export class SupplierDialog {
  private dialogRef = inject(MatDialogRef<SupplierDialog>);
  public data = inject<SupplierDialogData>(MAT_DIALOG_DATA);

  public name = signal(this.data.supplier?.name ?? '');
  public loading = signal(false);

  get isAdd() {
    return this.data.mode === 'add';
  }
  get isEdit() {
    return this.data.mode === 'edit';
  }
  get isView() {
    return this.data.mode === 'view';
  }
  get title() {
    return this.isAdd ? 'Add Supplier' : this.isEdit ? 'Edit Supplier' : 'View Supplier';
  }

  async ngOnInit() {}

  public async save() {
    this.dialogRef.close({
      name: this.name(),
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
