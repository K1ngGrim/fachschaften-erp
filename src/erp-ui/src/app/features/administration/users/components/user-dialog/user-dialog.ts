import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/list';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RoleDto, RolesService, UserDto } from '../../../../../../../projects/api/src/lib';

export type DialogMode = 'add' | 'edit' | 'view';

export interface UserDialogData {
  mode: DialogMode;
  user?: UserDto;
}

@Component({
  selector: 'app-user-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
    MatInput,
    FormsModule,
    MatDivider,
    MatSelect,
    MatOption,
    MatDialogActions,
    MatButton,
    MatSlideToggle,
  ],
  templateUrl: './user-dialog.html',
  styleUrl: './user-dialog.scss',
})
export class UserDialog {
  private dialogRef = inject(MatDialogRef<UserDialog>);
  private rolesService = inject(RolesService);

  public data = inject<UserDialogData>(MAT_DIALOG_DATA);

  public userName = signal(this.data.user?.userName ?? '');
  public email = signal(this.data.user?.email ?? '');
  public require2Fa = signal<boolean>(false);
  public password = signal('');
  public userRoles = signal<string[]>(this.data.user?.roles ?? []);
  public availableRoles = signal<RoleDto[]>([]);

  loading = signal(false);

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
    return this.isAdd ? 'Add User' : this.isEdit ? 'Edit User' : 'View User';
  }

  async ngOnInit() {
    const roles = await lastValueFrom(this.rolesService.apiRolesGet());
    this.availableRoles.set(roles);
  }

  getRoleName(roleId: string) {
    return this.availableRoles().find((r) => r.id === roleId)?.name ?? roleId;
  }

  public async save() {
    this.dialogRef.close({
      userName: this.userName(),
      email: this.email(),
      roles: this.userRoles(),
      require2Fa: this.require2Fa(),
    } as UserInviteData);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}

export interface UserInviteData {
  email: string;
  userName: string;
  require2Fa: boolean;
  roles?: Array<string>;
}
