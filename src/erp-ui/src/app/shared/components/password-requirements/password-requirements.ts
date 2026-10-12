import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PasswordPolicy } from '../../../core/services/password-policy';
import { checkPasswordRules } from '../../models/password-policy';

/** Zeigt die Passwortregeln aus dem Backend als Checkliste zum eingegebenen Passwort. */
@Component({
  selector: 'app-password-requirements',
  imports: [MatIcon],
  templateUrl: './password-requirements.html',
  styleUrl: './password-requirements.scss',
})
export class PasswordRequirements {
  private readonly passwordPolicy = inject(PasswordPolicy);

  public readonly password = input<string | null | undefined>('');

  public readonly rules = computed(() => {
    const policy = this.passwordPolicy.policy();
    return policy ? checkPasswordRules(policy, this.password() ?? '') : [];
  });

  constructor() {
    void this.passwordPolicy.load();
  }
}
