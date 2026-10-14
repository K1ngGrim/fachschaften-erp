import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import {
  CustomTableAccessService,
  RecoveryVaultInfoDto,
  VaultService,
} from '../../../../../../../projects/api/src/lib';
import { Auth } from '../../../../../core/services/auth';
import { DialogService } from '../../../../../core/services/dialog-service';
import { Vault } from '../../../../../core/services/vault';
import { VaultPanel } from '../../../../../shared/components/vault-panel/vault-panel';
import {
  createVault,
  generateRecoveryCode,
  normalizeRecoveryCode,
  unlockVault,
  unwrapTableKey,
  wrapTableKey,
  WrongPassphraseError,
} from '../../../../../shared/crypto/vault-crypto';
import { downloadText } from '../../../../../shared/models/download';
import { formatDate } from '../../../../../shared/models/finance';

type Mode = 'idle' | 'code' | 'restore';

/**
 * Wiederherstellungsschlüssel der Fachschaft: ein ausgedruckter Code, mit dem der Vorstand
 * wieder an alle vertraulichen Tabellen kommt, falls alle Berechtigten ihre Passphrase vergessen.
 */
@Component({
  selector: 'app-recovery-key-card',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
    VaultPanel,
  ],
  templateUrl: './recovery-key-card.html',
  styleUrl: './recovery-key-card.scss',
})
export class RecoveryKeyCard implements OnInit {
  private readonly vaultController = inject(VaultService);
  private readonly accessController = inject(CustomTableAccessService);
  private readonly dialogService = inject(DialogService);
  private readonly auth = inject(Auth);
  protected readonly vault = inject(Vault);

  protected readonly info = signal<RecoveryVaultInfoDto | null>(null);
  protected readonly loaded = signal(false);
  protected readonly mode = signal<Mode>('idle');
  protected readonly code = signal('');
  protected readonly stored = signal(false);
  protected readonly input = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly formatDate = formatDate;

  async ngOnInit() {
    await this.load();
  }

  protected async create() {
    if (this.info()) {
      const confirmed = await this.dialogService.openDeleteDialog({
        title: 'Wiederherstellungsschlüssel ersetzen',
        message:
          'Der bisherige Code wird ungültig. Die vertraulichen Tabellen bekommen den neuen ' +
          'Schlüssel, sobald jemand mit Zugriff sie das nächste Mal öffnet.',
        confirmLabel: 'Ersetzen',
      });
      if (!confirmed) return;
    }

    await this.run(async () => {
      const code = generateRecoveryCode();
      const { stored } = await createVault(normalizeRecoveryCode(code));
      await lastValueFrom(this.vaultController.apiVaultRecoveryPut({ saveVaultRequest: stored }));
      this.code.set(code);
      this.stored.set(false);
      this.mode.set('code');
      await this.load();
    });
  }

  protected download() {
    downloadText(
      'wiederherstellungsschluessel.txt',
      [
        'Wiederherstellungsschlüssel für vertrauliche Tabellen',
        '',
        this.code(),
        '',
        `Erstellt am ${new Date().toLocaleDateString('de-DE')}.`,
        'Sicher aufbewahren (z. B. ausgedruckt im Tresor des Vorstands) und nicht digital weitergeben.',
        'Einsetzen unter Einstellungen > Wiederherstellungsschlüssel > Zugriff wiederherstellen.',
      ].join('\r\n'),
      'text/plain',
    );
  }

  protected finish() {
    this.code.set('');
    this.mode.set('idle');
  }

  protected startRestore() {
    this.input.set('');
    this.error.set(null);
    this.success.set(null);
    this.mode.set('restore');
  }

  /** Entschlüsselt alle Tabellenschlüssel mit dem Code und gibt sie dem eigenen Tresor frei. */
  protected async restore() {
    const publicKey = this.vault.publicKey();
    if (!publicKey || this.vault.status() !== 'unlocked' || !this.input().trim()) return;

    await this.run(async () => {
      const recovery = await lastValueFrom(this.vaultController.apiVaultRecoveryKeysGet());
      let privateKey: CryptoKey;
      try {
        privateKey = await unlockVault(recovery.vault, normalizeRecoveryCode(this.input()));
      } catch (error) {
        if (error instanceof WrongPassphraseError) {
          throw new Error('Der Wiederherstellungsschlüssel ist falsch.');
        }
        throw error;
      }

      let restored = 0;
      for (const key of recovery.keys) {
        const tableKey = await unwrapTableKey(key.wrappedKey, privateKey);
        await lastValueFrom(
          this.accessController.apiCustomTablesIdAccessPost({
            id: key.tableId,
            grantTableAccessRequest: {
              userId: this.auth.userId(),
              wrappedKey: await wrapTableKey(tableKey, publicKey),
              keyVersion: key.keyVersion,
            },
          }),
        );
        restored++;
      }

      this.mode.set('idle');
      this.success.set(
        restored === 1
          ? 'Du hast wieder Zugriff auf 1 vertrauliche Tabelle.'
          : `Du hast wieder Zugriff auf ${restored} vertrauliche Tabellen.`,
      );
    });
  }

  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(
        error instanceof Error && !(error instanceof HttpErrorResponse) && error.message
          ? error.message
          : 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async load() {
    this.info.set(
      await lastValueFrom(this.vaultController.apiVaultRecoveryGet()).catch(() => null),
    );
    this.loaded.set(true);
  }
}
