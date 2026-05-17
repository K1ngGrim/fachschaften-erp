import { Component, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { DataGrid, GridActionCellDirective, GridColumn } from '../../../../../shared/components/data-grid/data-grid';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { lastValueFrom } from 'rxjs';
import { MatChip } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { UserDialog, UserDialogData, UserInviteData } from '../user-dialog/user-dialog';
import { InviteService, UserDto, UsersService } from '../../../../../../../projects/api/src/lib';

@Component({
  selector: 'app-user-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    MatChip,
    MatButton,
  ],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  public roleTemplate = viewChild<TemplateRef<any>>('roleTemplate');

  public userController = inject(UsersService);
  public dialog = inject(MatDialog);
  public inviteController = inject(InviteService);

  public users = signal<UserDto[]>([]);
  public columns = signal<GridColumn<UserDto>[]>([]);

  async ngOnInit() {
    this.columns.set([
      { key: 'userName', label: 'Name' },
      { key: 'email', label: 'Email' },
      {
        key: 'roles',
        label: 'Rollen',
        cellTemplate: this.roleTemplate(),
      },
    ]);

    await this.loadUsers();
  }

  private async loadUsers() {
    const users = await lastValueFrom(this.userController.apiUsersGet());
    this.users.set(users);
  }

  public async openAdd() {
    this.dialog
      .open(UserDialog, {
        width: '520px',
        data: { mode: 'add' } satisfies UserDialogData,
      })
      .afterClosed()
      .subscribe(async (result: UserInviteData) => {
        if (!result) return;
        await lastValueFrom(
          this.inviteController.apiInvitesPost({
            inviteRequest: {
              email: result.email,
              roles: result.roles ?? [],
              userName: result.userName,
              require2Fa: result.require2Fa,
            },
          }),
        );
        await this.loadUsers();
      });
  }

  public openEdit(user: UserDto) {
    this.dialog
      .open(UserDialog, {
        width: '520px',
        data: { mode: 'edit', user } satisfies UserDialogData,
      })
      .afterClosed()
      .subscribe(async (result: UserDto) => {
        if (!result) return;
        await lastValueFrom(
          this.userController.apiUsersIdPost({
            id: result.id,
            upsertUserRequest: {
              userName: result.userName,
              email: result.email,
              roles: result.roles,
              permissions: [],
            },
          }),
        );
        await this.loadUsers();
      });
  }

  public openView(user: UserDto) {
    this.dialog.open(UserDialog, {
      width: '520px',
      data: { mode: 'view', user } satisfies UserDialogData,
    });
  }
}
