import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import { CustomTableDto, VaultService } from '../../../../../../projects/api/src/lib';
import { PlainRow, Vault } from '../../../../core/services/vault';
import { VaultPanel } from '../../../../shared/components/vault-panel/vault-panel';

export interface TableConfidentialDialogData {
  table: CustomTableDto;
  rows: PlainRow[];
}

/** Macht eine bestehende Tabelle vertraulich; schließt mit true, wenn das geklappt hat. */
@Component({
  selector: 'app-table-confidential-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatProgressSpinner,
    VaultPanel,
  ],
  templateUrl: './table-confidential-dialog.html',
})
export class TableConfidentialDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<TableConfidentialDialog, boolean>);
  private readonly vaultController = inject(VaultService);
  protected readonly vault = inject(Vault);
  protected readonly data = inject<TableConfidentialDialogData>(MAT_DIALOG_DATA);

  protected readonly hasRecoveryKey = signal<boolean | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit() {
    this.hasRecoveryKey.set(
      await lastValueFrom(this.vaultController.apiVaultRecoveryGet())
        .then(() => true)
        .catch(() => false),
    );
  }

  protected async confirm() {
    if (this.vault.status() !== 'unlocked' || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.vault.makeConfidential(this.data.table.id, this.data.rows);
      this.dialogRef.close(true);
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 400
          ? 'Die Tabelle wurde inzwischen geändert. Bitte lade sie neu und versuche es noch einmal.'
          : 'Die Tabelle konnte nicht verschlüsselt werden.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel() {
    this.dialogRef.close(false);
  }
}
