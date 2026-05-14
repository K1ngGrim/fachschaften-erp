import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, TwoFactorService } from '../../../../../projects/api/src/lib';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { NgOptimizedImage } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/list';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { lastValueFrom } from 'rxjs';
import { NgOtpInputComponent } from 'ng-otp-input';

@Component({
  selector: 'app-setup-2fa-page',
  imports: [
    MatIcon,
    MatCard,
    MatCardContent,
    MatProgressSpinner,
    NgOptimizedImage,
    MatIconButton,
    MatDivider,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    MatTooltip,
    NgOtpInputComponent,
  ],
  templateUrl: './setup-fa-page.html',
  styleUrl: './setup-fa-page.scss',
})
export class Setup2faPage implements OnInit {
  private router = inject(Router);
  private twoFaController = inject(TwoFactorService);

  loading = signal(true);
  verifying = signal(false);
  error = signal<string | null>(null);
  qrCode = signal('');
  secret = signal('');

  form = new FormGroup({
    code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
  });

  async ngOnInit() {
    try {
      const result = await lastValueFrom(this.twoFaController.apiAuth2faSetupGet());
      this.qrCode.set(result.qrCode);
      this.secret.set(result.secret);
    } finally {
      this.loading.set(false);
    }
  }

  async verify() {
    if (this.form.invalid) return;
    this.verifying.set(true);
    this.error.set(null);

    try {
      await lastValueFrom(
        this.twoFaController.apiAuth2faSetupPost({
          setup2FaRequest: {
            code: this.form.value.code!,
          },
        }),
      );
      await this.router.navigate(['/login']);
    } catch {
      this.error.set('Invalid code. Please try again.');
    } finally {
      this.verifying.set(false);
    }
  }

  copySecret() {
    navigator.clipboard.writeText(this.secret());
  }
}
