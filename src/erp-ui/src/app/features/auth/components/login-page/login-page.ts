import { Component, inject, signal } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import {
  MatError,
  MatFormField,
  MatInput,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Auth } from '../../../../core/services/auth';
import { Organization } from '../../../../core/services/organization';
import { AuthService } from '../../../../../../projects/api/src/lib';

@Component({
  selector: 'app-login-page',
  imports: [
    MatCard,
    MatCardContent,
    MatIcon,
    MatLabel,
    MatFormField,
    MatError,
    MatButton,
    MatProgressSpinner,
    MatInput,
    MatPrefix,
    MatSuffix,
    ReactiveFormsModule,
    MatIconButton,
    RouterLink,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private authService = inject(Auth);
  protected readonly organization = inject(Organization).settings;
  private router = inject(Router);
  private authController = inject(AuthService);

  form = new FormGroup({
    login: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });

  public loading = signal(false);
  public error = signal<string | null>(null);
  public showPassword = signal(false);

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await lastValueFrom(
        this.authController.apiAuthLoginPost({
          loginRequest: {
            login: this.form.value.login!,
            password: this.form.value.password!,
            rememberMe: true,
          },
        }),
      );

      if (result.requiresTwoFactor) {
        await this.router.navigate(['/login/2fa']);
      } else {
        await this.authService.refresh();
        await this.router.navigate(['/']);
      }
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? 'Zu viele Fehlversuche. Bitte warte ein paar Minuten.'
          : 'Benutzername, E-Mail oder Passwort ist falsch.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
