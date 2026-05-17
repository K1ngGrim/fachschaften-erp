import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InviteService } from '../../../../../../projects/api/src/lib';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-accept-invite-page',
  imports: [
    MatIcon,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatIconButton,
    MatError,
    MatButton,
    MatProgressSpinner,
  ],
  templateUrl: './accept-invite-page.html',
  styleUrl: './accept-invite-page.scss',
})
export class AcceptInvitePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private inviteService = inject(InviteService);

  inviteId = signal('');
  token = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  invalidLink = signal(false);

  form = new FormGroup(
    {
      password: new FormControl('', [Validators.required, Validators.minLength(3)]),
      confirmPassword: new FormControl('', Validators.required),
    },
    { validators: passwordMatchValidator },
  );

  ngOnInit() {
    const inviteId = this.route.snapshot.queryParams['inviteId'];
    const token = this.route.snapshot.queryParams['token'];

    if (!inviteId || !token) {
      this.invalidLink.set(true);
      return;
    }

    this.inviteId.set(inviteId);
    this.token.set(token);
  }

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await lastValueFrom(
        this.inviteService.apiInvitesAcceptPost({
          acceptInviteRequest: {
            inviteId: this.inviteId(),
            token: this.token(),
            password: this.form.value.password!,
          },
        }),
      );

      if (result.require2Fa) {
        await this.router.navigate(['/setup-2fa']);
      } else {
        await this.router.navigate(['/login']);
      }
    } catch {
      this.error.set('This invite link is invalid or has expired.');
    } finally {
      this.loading.set(false);
    }
  }
}

function passwordMatchValidator(group: AbstractControl) {
  const pw  = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw === cpw ? null : { passwordMismatch: true };
}
