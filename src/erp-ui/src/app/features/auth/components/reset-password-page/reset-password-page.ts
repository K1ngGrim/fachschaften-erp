import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { MatFormField, MatInput, MatLabel, MatPrefix } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../../../../../projects/api/src/lib';
import { PasswordPolicy } from '../../../../core/services/password-policy';
import { PasswordRequirements } from '../../../../shared/components/password-requirements/password-requirements';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value
    ? null
    : { mismatch: true };

@Component({
  selector: 'app-reset-password-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCard,
    MatCardContent,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatPrefix,
    MatIcon,
    MatProgressSpinner,
    PasswordRequirements,
  ],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage implements OnInit {
  private readonly authController = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  public readonly form = new FormGroup(
    {
      newPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    },
    { validators: passwordsMatch },
  );
  public readonly invalidLink = signal(false);
  public readonly saving = signal(false);
  public readonly done = signal(false);
  public readonly error = signal<string | null>(null);

  private userId = '';
  private token = '';

  constructor() {
    void inject(PasswordPolicy).applyTo(this.form.controls.newPassword);
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.userId = params.get('userId') ?? '';
    this.token = params.get('token') ?? '';
    this.invalidLink.set(!this.userId || !this.token);
  }

  public async submit() {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await lastValueFrom(
        this.authController.apiAuthResetPasswordPost({
          resetPasswordRequest: {
            userId: this.userId,
            token: this.token,
            newPassword: this.form.getRawValue().newPassword,
          },
        }),
      );
      this.done.set(true);
    } catch (error) {
      if (isInvalidToken(error)) {
        this.invalidLink.set(true);
      } else if (error instanceof HttpErrorResponse && error.status === 429) {
        this.error.set('Zu viele Versuche. Bitte warte eine Viertelstunde.');
      } else {
        this.error.set('Das Passwort erfüllt die Anforderungen nicht.');
      }
    } finally {
      this.saving.set(false);
    }
  }
}

function isInvalidToken(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    Array.isArray(error.error) &&
    error.error.some((e: { code?: string }) => e.code === 'InvalidToken')
  );
}
