import { Component, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DataGrid,
  GridActionCellDirective,
  GridColumn,
} from '../../../../../shared/components/data-grid/data-grid';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { lastValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { UserDialog, UserDialogData, UserDialogResult } from '../user-dialog/user-dialog';
import {
  InviteService,
  UserDto,
  UsersService,
  UserStatus,
} from '../../../../../../../projects/api/src/lib';
import { Auth } from '../../../../../core/services/auth';
import { DialogService } from '../../../../../core/services/dialog-service';
import { PermissionType } from '../../../../../shared/models/permission-type';

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.Active]: 'Aktiv',
  [UserStatus.InvitePending]: 'Einladung offen',
  [UserStatus.InviteExpired]: 'Einladung abgelaufen',
};

@Component({
  selector: 'app-user-page',
  imports: [
    DataGrid,
    GridActionCellDirective,
    MatIcon,
    MatIconButton,
    MatTooltip,
    PageHeader,
    MatButton,
  ],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  private readonly nameTemplate = viewChild<TemplateRef<any>>('nameTemplate');
  private readonly roleTemplate = viewChild<TemplateRef<any>>('roleTemplate');
  private readonly statusTemplate = viewChild<TemplateRef<any>>('statusTemplate');

  private readonly userController = inject(UsersService);
  private readonly inviteController = inject(InviteService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogService = inject(DialogService);
  private readonly auth = inject(Auth);

  public readonly users = signal<UserDto[]>([]);
  public readonly columns = signal<GridColumn<UserDto>[]>([]);
  public readonly error = signal<string | null>(null);
  public readonly info = signal<string | null>(null);

  public readonly canWrite = this.auth.hasPermission(PermissionType.UsersCanWrite);
  private readonly canAssignRoles = this.auth.hasPermission(PermissionType.PermissionsCanWrite);
  public readonly currentUserId = this.auth.userId;
  public readonly UserStatus = UserStatus;

  public statusLabel(status: UserStatus): string {
    return STATUS_LABELS[status];
  }

  async ngOnInit() {
    this.columns.set([
      { key: 'displayName', label: 'Name', cellTemplate: this.nameTemplate() },
      { key: 'roles', label: 'Rollen', cellTemplate: this.roleTemplate() },
      { key: 'status', label: 'Status', cellTemplate: this.statusTemplate() },
    ]);

    await this.loadUsers();
  }

  public async openInvite() {
    const result = await this.openDialog({ mode: 'invite', canAssignRoles: this.canAssignRoles });
    if (!result) return;

    await this.run(
      () =>
        lastValueFrom(
          this.inviteController.apiInvitesPost({
            inviteRequest: {
              displayName: result.displayName || null,
              email: result.email,
              roleIds: result.roleIds,
              require2Fa: result.require2Fa,
            },
          }),
        ),
      `Einladung an ${result.email} verschickt.`,
    );
  }

  public async openEdit(user: UserDto) {
    const result = await this.openDialog({
      mode: 'edit',
      user,
      canAssignRoles: this.canAssignRoles,
    });
    if (!result) return;

    await this.run(() =>
      lastValueFrom(
        this.userController.apiUsersIdPut({
          id: user.id,
          updateUserRequest: {
            displayName: result.displayName || null,
            email: result.email || null,
            // Ohne Recht zur Rollenvergabe die Rollen nicht mitschicken (bleiben unverändert).
            roleIds: this.canAssignRoles ? result.roleIds : null,
          },
        }),
      ),
    );
  }

  public async resendInvite(user: UserDto) {
    await this.run(
      () => lastValueFrom(this.inviteController.apiInvitesUserIdResendPost({ userId: user.id })),
      `Einladung erneut an ${user.email} verschickt. Ältere Links sind jetzt ungültig.`,
    );
  }

  public async delete(user: UserDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Benutzer löschen',
      message: `„${user.displayName}“ löschen? Das Konto kann danach nicht mehr verwendet werden.`,
      confirmLabel: 'Löschen',
    });
    if (!confirmed) return;

    await this.run(() => lastValueFrom(this.userController.apiUsersIdDelete({ id: user.id })));
  }

  private openDialog(data: UserDialogData): Promise<UserDialogResult | undefined> {
    return lastValueFrom(this.dialog.open(UserDialog, { width: '520px', data }).afterClosed());
  }

  /** Führt eine Änderung aus, zeigt Fehler oder Erfolg an und lädt die Liste neu. */
  private async run(action: () => Promise<unknown>, success?: string) {
    this.error.set(null);
    this.info.set(null);
    try {
      await action();
      if (success) this.info.set(success);
    } catch (error) {
      this.error.set(describeError(error));
    }
    await this.loadUsers();
  }

  private async loadUsers() {
    this.users.set(await lastValueFrom(this.userController.apiUsersGet()));
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Die Aktion ist fehlgeschlagen.';

  const message = typeof error.error === 'string' ? error.error : '';
  if (error.status === 502) return 'Die E-Mail konnte nicht verschickt werden.';
  if (error.status === 403) return 'Dafür fehlen dir die Rechte.';
  if (message.includes('last admin')) return 'Der letzte Admin kann nicht entfernt werden.';
  if (message.includes('own account')) return 'Du kannst dein eigenes Konto nicht löschen.';
  if (message.includes('email already') || message.includes('already exists'))
    return 'Diese E-Mail-Adresse wird bereits verwendet.';
  return 'Die Aktion ist fehlgeschlagen.';
}
