import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RoleDto, RolesService, UserDto } from '../../../../../../../projects/api/src/lib';

export interface UserDialogData {
  mode: 'invite' | 'edit';
  user?: UserDto;
  /** Rollen ändern erfordert permissions.canwrite. */
  canAssignRoles: boolean;
}

export interface UserDialogResult {
  displayName: string;
  email: string;
  roleIds: string[];
  require2Fa: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-user-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    FormsModule,
    MatSelect,
    MatOption,
    MatDialogActions,
    MatButton,
    MatSlideToggle,
  ],
  templateUrl: './user-dialog.html',
  styleUrl: './user-dialog.scss',
})
export class UserDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<UserDialog, UserDialogResult>);
  private readonly rolesService = inject(RolesService);

  public readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  public readonly isInvite = this.data.mode === 'invite';

  public readonly displayName = signal(this.data.user?.displayName ?? '');
  public readonly email = signal(this.data.user?.email ?? '');
  public readonly roleIds = signal<string[]>(this.data.user?.roles.map((r) => r.id) ?? []);
  public readonly require2Fa = signal(false);
  public readonly availableRoles = signal<RoleDto[]>([]);

  public readonly emailValid = computed(() => EMAIL_PATTERN.test(this.email().trim()));

  public readonly canSave = computed(() =>
    this.isInvite ? this.emailValid() : !this.email().trim() || this.emailValid(),
  );

  async ngOnInit() {
    this.availableRoles.set(await lastValueFrom(this.rolesService.apiRolesGet()));
  }

  public save() {
    if (!this.canSave()) return;

    this.dialogRef.close({
      displayName: this.displayName().trim(),
      email: this.email().trim(),
      roleIds: this.roleIds(),
      require2Fa: this.require2Fa(),
    });
  }

  public cancel() {
    this.dialogRef.close();
  }
}
