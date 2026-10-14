import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import { TwoFactorService, UsersService } from '../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../core/services/auth';
import { PasswordPolicy } from '../../../../core/services/password-policy';
import { PasswordRequirements } from '../../../../shared/components/password-requirements/password-requirements';
import { describePasswordChangeError } from '../../../../shared/models/password-errors';
import { VaultCard } from '../vault-card/vault-card';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value
    ? null
    : { mismatch: true };

@Component({
  selector: 'app-account-page',
  imports: [
    ReactiveFormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
    PageHeader,
    PasswordRequirements,
    VaultCard,
  ],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage {
  private readonly usersController = inject(UsersService);
  private readonly twoFactorController = inject(TwoFactorService);
  private readonly router = inject(Router);
  protected readonly auth = inject(Auth);

  public readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      newPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    },
    { validators: passwordsMatch },
  );
  public readonly passwordSaving = signal(false);
  public readonly passwordError = signal<string | null>(null);
  public readonly passwordChanged = signal(false);

  public readonly twoFactorForm = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  public readonly twoFactorResetting = signal(false);
  public readonly twoFactorError = signal<string | null>(null);

  constructor() {
    void inject(PasswordPolicy).applyTo(this.passwordForm.controls.newPassword);
  }

  public async changePassword(formDirective: FormGroupDirective) {
    if (this.passwordForm.invalid) return;

    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordChanged.set(false);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    try {
      await lastValueFrom(
        this.usersController.apiUsersIdChangePasswordPost({
          id: this.auth.userId(),
          changePasswordRequest: { currentPassword, newPassword },
        }),
      );
      // resetForm statt reset: setzt auch den "submitted"-Status zurück, sonst sind die leeren Felder rot.
      formDirective.resetForm();
      this.passwordChanged.set(true);
    } catch (error) {
      this.passwordError.set(describePasswordChangeError(error));
    } finally {
      this.passwordSaving.set(false);
    }
  }

  /**
   * Erzeugt einen neuen Authenticator-Schlüssel. Danach erzwingt der setup2faGuard die
   * Einrichtung, bis sie bestätigt ist.
   */
  public async resetTwoFactor() {
    if (this.twoFactorForm.invalid) return;

    this.twoFactorResetting.set(true);
    this.twoFactorError.set(null);

    try {
      await lastValueFrom(
        this.twoFactorController.apiAuth2faResetPost({
          reset2FaRequest: { password: this.twoFactorForm.getRawValue().password },
        }),
      );
      await this.auth.refresh();
      await this.router.navigate(['/setup-2fa']);
    } catch (error) {
      this.twoFactorError.set(
        error instanceof HttpErrorResponse && error.status === 400
          ? 'Das Passwort ist falsch.'
          : '2FA konnte nicht zurückgesetzt werden.',
      );
    } finally {
      this.twoFactorResetting.set(false);
    }
  }
}
