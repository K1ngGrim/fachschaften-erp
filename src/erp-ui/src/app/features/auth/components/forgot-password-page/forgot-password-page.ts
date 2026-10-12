import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel, MatPrefix } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../../../../../projects/api/src/lib';

@Component({
  selector: 'app-forgot-password-page',
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
  ],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly authController = inject(AuthService);

  public readonly login = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  public readonly sending = signal(false);
  public readonly sent = signal(false);
  public readonly error = signal<string | null>(null);

  public async submit() {
    if (this.login.invalid) return;

    this.sending.set(true);
    this.error.set(null);
    try {
      await lastValueFrom(
        this.authController.apiAuthForgotPasswordPost({
          forgotPasswordRequest: { login: this.login.value.trim() },
        }),
      );
      this.sent.set(true);
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? 'Zu viele Anfragen. Bitte versuche es in einer Viertelstunde noch einmal.'
          : 'Die Anfrage ist fehlgeschlagen. Bitte versuche es später noch einmal.',
      );
    } finally {
      this.sending.set(false);
    }
  }
}
