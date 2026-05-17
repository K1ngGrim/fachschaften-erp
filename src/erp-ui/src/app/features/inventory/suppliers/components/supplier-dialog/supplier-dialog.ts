import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/list';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { email } from '@angular/forms/signals';
import {
  RoleDto,
  RolesService,
  SupplierDto,
  UserDto,
} from '../../../../../../../projects/api/src/lib';
import { lastValueFrom } from 'rxjs';
import {
  DialogMode,
  UserDialogData,
  UserInviteData,
} from '../../../../administration/users/components/user-dialog/user-dialog';

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
    MatDivider,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSlideToggle,
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
