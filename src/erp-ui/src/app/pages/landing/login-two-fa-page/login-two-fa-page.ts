import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../projects/api/src/lib';
import { Auth } from '../../../shared/services/auth';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgOtpInputComponent } from 'ng-otp-input';

@Component({
  selector: 'app-login-two-fa-page',
  imports: [
    MatIcon,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatButton,
    MatProgressSpinner,
    NgOtpInputComponent,
  ],
  templateUrl: './login-two-fa-page.html',
  styleUrl: './login-two-fa-page.scss',
})
export class LoginTwoFaPage {
  private router = inject(Router);
  private authController = inject(AuthService);
  private authService = inject(Auth);

  loading = signal(false);
  error = signal<string | null>(null);

  form = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
  });

  async verify() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      await lastValueFrom(
        this.authController.apiAuthLogin2faPost({
          login2FaRequest: {
            code: this.form.value.code!,
            rememberMe: false,
          },
        }),
      );
      await this.authService.refresh();
      await this.router.navigate(['/']);
    } catch {
      this.error.set('Invalid code. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
