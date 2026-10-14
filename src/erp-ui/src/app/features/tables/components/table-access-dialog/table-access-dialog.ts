import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableAccessService,
  CustomTableDto,
  TableAccessDto,
  TableAccessMemberDto,
} from '../../../../../../projects/api/src/lib';
import { Auth } from '../../../../core/services/auth';
import { DialogService } from '../../../../core/services/dialog-service';
import { KeyRecipient, PlainRow, Vault } from '../../../../core/services/vault';

export interface TableAccessDialogData {
  table: CustomTableDto;
  /** Alle Einträge entschlüsselt; nötig, um beim Entziehen neu zu verschlüsseln. */
  rows: PlainRow[];
  /** Ließen sich alle Einträge entschlüsseln? Sonst ist Entziehen nicht möglich. */
  complete: boolean;
}

/** Freigaben einer vertraulichen Tabelle; schließt mit true, wenn sich etwas geändert hat. */
@Component({
  selector: 'app-table-access-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './table-access-dialog.html',
  styleUrl: './table-access-dialog.scss',
})
export class TableAccessDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<TableAccessDialog, boolean>);
  private readonly accessController = inject(CustomTableAccessService);
  private readonly dialogService = inject(DialogService);
  private readonly vault = inject(Vault);
  protected readonly data = inject<TableAccessDialogData>(MAT_DIALOG_DATA);
  protected readonly userId = inject(Auth).userId();

  protected readonly access = signal<TableAccessDto | null>(null);
  protected readonly busyUser = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private changed = false;

  /** Erst Personen mit Zugriff, dann mit Tresor, dann ohne. */
  protected readonly members = computed(() =>
    [...(this.access()?.members ?? [])].sort(
      (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'de'),
    ),
  );

  async ngOnInit() {
    await this.load();
  }

  protected async grant(member: TableAccessMemberDto) {
    if (!member.publicKey) return;
    await this.run(member, async () => {
      await this.vault.grant(this.data.table, member.userId, member.publicKey!);
      this.changed = true;
      await this.load();
    });
  }

  /** Entziehen heißt: neuer Tabellenschlüssel nur noch für die übrigen Personen. */
  protected async revoke(member: TableAccessMemberDto) {
    const confirmed = await this.dialogService.openDeleteDialog({
      title: 'Zugriff entziehen',
      message:
        `${member.name} verliert den Zugriff auf „${this.data.table.name}“. Dafür bekommt die ` +
        'Tabelle einen neuen Schlüssel und alle Einträge werden neu verschlüsselt.',
      confirmLabel: 'Entziehen',
    });
    if (!confirmed) return;

    const remaining: KeyRecipient[] = this.members()
      .filter((m) => m.hasAccess && m.userId !== member.userId && m.vaultId && m.publicKey)
      .map((m) => ({ vaultId: m.vaultId!, publicKey: m.publicKey! }));

    await this.run(member, async () => {
      await this.vault.rotateKey(this.data.table, this.data.rows, remaining);
      // Der alte Schlüssel ist ungültig; die Tabellenseite lädt neu.
      this.dialogRef.close(true);
    });
  }

  protected close() {
    this.dialogRef.close(this.changed);
  }

  private async run(member: TableAccessMemberDto, action: () => Promise<void>) {
    this.busyUser.set(member.userId);
    this.error.set(null);
    try {
      await action();
    } catch {
      this.error.set(
        'Das hat nicht geklappt. Eventuell wurde die Tabelle inzwischen geändert; lade sie neu und versuche es noch einmal.',
      );
    } finally {
      this.busyUser.set(null);
    }
  }

  private async load() {
    this.access.set(
      await lastValueFrom(
        this.accessController.apiCustomTablesIdAccessGet({ id: this.data.table.id }),
      ),
    );
  }
}

function rank(member: TableAccessMemberDto): number {
  if (member.hasAccess) return 0;
  return member.vaultId ? 1 : 2;
}
