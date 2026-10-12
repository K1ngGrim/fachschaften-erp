import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import { UsersService } from '../../../../../../projects/api/src/lib';
import { Auth } from '../../../../core/services/auth';
import { PasswordPolicy } from '../../../../core/services/password-policy';
import { PasswordRequirements } from '../../../../shared/components/password-requirements/password-requirements';
import { describePasswordChangeError } from '../../../../shared/models/password-errors';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value
    ? null
    : { mismatch: true };

/** Pflicht-Passwortwechsel beim ersten Login, z. B. für den beim Erststart angelegten Admin. */
@Component({
  selector: 'app-change-password-page',
  imports: [
    ReactiveFormsModule,
    MatCard,
    MatCardContent,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatIcon,
    MatProgressSpinner,
    PasswordRequirements,
  ],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly usersController = inject(UsersService);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  public readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      newPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    },
    { validators: passwordsMatch },
  );
  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);

  constructor() {
    void inject(PasswordPolicy).applyTo(this.form.controls.newPassword);
  }

  public async submit() {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const { currentPassword, newPassword } = this.form.getRawValue();
    try {
      await lastValueFrom(
        this.usersController.apiUsersIdChangePasswordPost({
          id: this.auth.userId(),
          changePasswordRequest: { currentPassword, newPassword },
        }),
      );
      await this.auth.refresh();
      await this.router.navigate(['/']);
    } catch (error) {
      this.error.set(describePasswordChangeError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
