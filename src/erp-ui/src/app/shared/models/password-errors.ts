import { HttpErrorResponse } from '@angular/common/http';

/** Übersetzt die Fehlerantwort von `change-password` (ASP.NET-Identity-Fehlerliste) in einen Hinweis. */
export function describePasswordChangeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return 'Das Passwort konnte nicht geändert werden.';
  }

  const codes: string[] = Array.isArray(error.error)
    ? error.error.map((e: { code?: string }) => e.code ?? '')
    : [];

  if (codes.includes('PasswordMismatch')) return 'Das aktuelle Passwort ist falsch.';
  if (codes.includes('PasswordUnchanged'))
    return 'Das neue Passwort muss sich vom aktuellen unterscheiden.';
  if (codes.includes('PasswordTooShort')) return 'Das neue Passwort ist zu kurz.';
  return 'Das neue Passwort erfüllt die Anforderungen nicht.';
}
