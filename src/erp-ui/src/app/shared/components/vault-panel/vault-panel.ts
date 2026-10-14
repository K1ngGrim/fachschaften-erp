import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Vault } from '../../../core/services/vault';
import { WrongPassphraseError } from '../../crypto/vault-crypto';

export const MIN_PASSPHRASE_LENGTH = 12;

/**
 * Richtet den Tresor ein oder entsperrt ihn. Zeigt nichts, wenn er schon entsperrt ist.
 */
@Component({
  selector: 'app-vault-panel',
  imports: [
    FormsModule,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatProgressSpinner,
  ],
  templateUrl: './vault-panel.html',
  styleUrl: './vault-panel.scss',
})
export class VaultPanel implements OnInit {
  protected readonly vault = inject(Vault);

  /** Erklärung, wofür der Tresor gerade gebraucht wird. */
  public readonly reason = input('Diese Daten sind Ende-zu-Ende-verschlüsselt.');
  public readonly unlocked = output<void>();

  protected readonly passphrase = signal('');
  protected readonly repeat = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly MIN_LENGTH = MIN_PASSPHRASE_LENGTH;

  protected readonly setupProblem = computed(() => {
    if (this.passphrase().length < MIN_PASSPHRASE_LENGTH) {
      return `Mindestens ${MIN_PASSPHRASE_LENGTH} Zeichen.`;
    }
    if (this.passphrase() !== this.repeat()) return 'Die Eingaben stimmen nicht überein.';
    return null;
  });

  async ngOnInit() {
    try {
      if ((await this.vault.load()) === 'unlocked') this.unlocked.emit();
    } catch {
      this.error.set('Der Tresor konnte nicht geladen werden.');
    }
  }

  protected async unlock() {
    if (!this.passphrase() || this.busy()) return;
    await this.run(async () => {
      await this.vault.unlock(this.passphrase());
    });
  }

  protected async setup() {
    if (this.setupProblem() || this.busy()) return;
    await this.run(async () => {
      await this.vault.setup(this.passphrase());
    });
  }

  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      this.passphrase.set('');
      this.repeat.set('');
      this.unlocked.emit();
    } catch (error) {
      this.error.set(
        error instanceof WrongPassphraseError
          ? 'Die Passphrase ist falsch.'
          : error instanceof Error && error.message.includes('HTTPS')
            ? error.message
            : 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
