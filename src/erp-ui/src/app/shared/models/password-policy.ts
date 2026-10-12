import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PasswordPolicyDto } from '../../../../projects/api/src/lib';

export interface PasswordRule {
  label: string;
  met: boolean;
}

/**
 * Prüft ein Passwort gegen die Regeln aus dem Backend. Bildet die Prüfungen von
 * ASP.NET Identity nach (Groß-/Kleinbuchstaben und Ziffern nur ASCII).
 */
export function checkPasswordRules(policy: PasswordPolicyDto, value: string): PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      label: `Mindestens ${policy.requiredLength} Zeichen`,
      met: value.length >= policy.requiredLength,
    },
  ];

  if (policy.requireLowercase)
    rules.push({ label: 'Ein Kleinbuchstabe', met: /[a-z]/.test(value) });
  if (policy.requireUppercase) rules.push({ label: 'Ein Großbuchstabe', met: /[A-Z]/.test(value) });
  if (policy.requireDigit) rules.push({ label: 'Eine Ziffer', met: /[0-9]/.test(value) });
  if (policy.requireNonAlphanumeric) {
    rules.push({ label: 'Ein Sonderzeichen', met: /[^a-zA-Z0-9]/.test(value) });
  }
  if (policy.requiredUniqueChars > 1) {
    rules.push({
      label: `Mindestens ${policy.requiredUniqueChars} verschiedene Zeichen`,
      met: new Set(value).size >= policy.requiredUniqueChars,
    });
  }

  return rules;
}

export function passwordPolicyValidator(policy: () => PasswordPolicyDto | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const current = policy();
    if (!current || !control.value) return null;

    return checkPasswordRules(current, control.value).every((rule) => rule.met)
      ? null
      : { passwordPolicy: true };
  };
}
