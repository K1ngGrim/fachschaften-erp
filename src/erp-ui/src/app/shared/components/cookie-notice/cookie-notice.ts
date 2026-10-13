import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

/**
 * Hinweis auf die technisch notwendigen Cookies. Die App setzt keine optionalen Cookies und lädt
 * nichts von Dritten, deshalb ist keine Einwilligung nötig (§ 25 Abs. 2 TDDDG) – nur ein Hinweis.
 * Kommt je etwas Optionales dazu (Statistik, externe Inhalte), muss hier eine echte Auswahl hin.
 */
@Component({
  selector: 'app-cookie-notice',
  imports: [RouterLink, MatButton],
  templateUrl: './cookie-notice.html',
  styleUrl: './cookie-notice.scss',
})
export class CookieNotice {
  /** Erhöhen, wenn sich die eingesetzten Cookies ändern; dann erscheint der Hinweis erneut. */
  private static readonly VERSION = '1';
  private static readonly STORAGE_KEY = 'erp.cookie-notice';

  public readonly visible = signal(CookieNotice.read() !== CookieNotice.VERSION);

  public dismiss() {
    try {
      localStorage.setItem(CookieNotice.STORAGE_KEY, CookieNotice.VERSION);
    } catch {
      // Ohne Speicher (z. B. privater Modus) erscheint der Hinweis beim nächsten Laden erneut.
    }
    this.visible.set(false);
  }

  private static read(): string | null {
    try {
      return localStorage.getItem(CookieNotice.STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
