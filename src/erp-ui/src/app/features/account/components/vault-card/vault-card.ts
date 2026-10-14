import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Vault } from '../../../../core/services/vault';
import {
  MIN_PASSPHRASE_LENGTH,
  VaultPanel,
} from '../../../../shared/components/vault-panel/vault-panel';
import { WrongPassphraseError } from '../../../../shared/crypto/vault-crypto';

type Mode = 'idle' | 'change' | 'reset';

/** Tresor für vertrauliche Tabellen: einrichten, Passphrase ändern, zurücksetzen. */
@Component({
  selector: 'app-vault-card',
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
  templateUrl: './vault-card.html',
})
export class VaultCard {
  protected readonly vault = inject(Vault);

  protected readonly mode = signal<Mode>('idle');
  protected readonly current = signal('');
  protected readonly passphrase = signal('');
  protected readonly repeat = signal('');
  protected readonly resetConfirmed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly problem = computed(() => {
    if (this.mode() === 'change' && !this.current()) return 'Gib deine bisherige Passphrase ein.';
    if (this.passphrase().length < MIN_PASSPHRASE_LENGTH) {
      return `Die neue Passphrase braucht mindestens ${MIN_PASSPHRASE_LENGTH} Zeichen.`;
    }
    if (this.passphrase() !== this.repeat()) return 'Die Eingaben stimmen nicht überein.';
    if (this.mode() === 'reset' && !this.resetConfirmed()) return 'Bitte bestätige den Hinweis.';
    return null;
  });

  protected start(mode: Mode) {
    this.mode.set(mode);
    this.current.set('');
    this.passphrase.set('');
    this.repeat.set('');
    this.resetConfirmed.set(false);
    this.error.set(null);
    this.success.set(null);
  }

  protected async submit() {
    if (this.problem() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      let message: string;
      if (this.mode() === 'change') {
        await this.vault.changePassphrase(this.current(), this.passphrase());
        message = 'Die Passphrase ist geändert. Deine Freigaben bleiben erhalten.';
      } else {
        await this.vault.reset(this.passphrase());
        message = 'Der Tresor ist neu eingerichtet. Lass dir vertrauliche Tabellen neu freigeben.';
      }
      this.start('idle');
      this.success.set(message);
    } catch (error) {
      this.error.set(
        error instanceof WrongPassphraseError
          ? 'Die bisherige Passphrase ist falsch.'
          : 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
