import { inject, Injectable, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { catchError, lastValueFrom, of } from 'rxjs';
import { AuthService, PasswordPolicyDto } from '../../../../projects/api/src/lib';
import { passwordPolicyValidator } from '../../shared/models/password-policy';

/** Lädt die Passwortregeln einmal vom Backend; das Backend bleibt die einzige Quelle. */
@Injectable({
  providedIn: 'root',
})
export class PasswordPolicy {
  private readonly authController = inject(AuthService);
  private loading: Promise<PasswordPolicyDto | null> | null = null;

  readonly policy = signal<PasswordPolicyDto | null>(null);

  load(): Promise<PasswordPolicyDto | null> {
    // Schlägt das Laden fehl, prüft eben nur das Backend.
    this.loading ??= lastValueFrom(
      this.authController.apiAuthPasswordPolicyGet().pipe(catchError(() => of(null))),
    ).then((policy) => {
      this.policy.set(policy);
      return policy;
    });

    return this.loading;
  }

  /** Hängt die Regeln als Validator an das Feld, sobald sie geladen sind. */
  async applyTo(control: AbstractControl): Promise<void> {
    control.addValidators(passwordPolicyValidator(() => this.policy()));
    await this.load();
    control.updateValueAndValidity();
  }
}
