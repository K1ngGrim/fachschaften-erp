import { inject, Injectable, signal } from '@angular/core';
import { catchError, lastValueFrom, of } from 'rxjs';
import { OrganizationSettingsDto, SettingsService } from '../../../../projects/api/src/lib';

const DEFAULTS: OrganizationSettingsDto = {
  name: 'Fachschaften ERP',
  subtitle: null,
  accentColor: '#e8912a',
  logoDataUrl: null,
  privacyContact: null,
  imprintUrl: null,
};

/** Name, Logo und Farbe der Fachschaft; wird beim Start geladen und als CSS-Variablen gesetzt. */
@Injectable({ providedIn: 'root' })
export class Organization {
  private readonly settingsController = inject(SettingsService);

  readonly settings = signal<OrganizationSettingsDto>(DEFAULTS);

  async load(): Promise<void> {
    const settings = await lastValueFrom(
      this.settingsController.apiSettingsOrganizationGet().pipe(catchError(() => of(DEFAULTS))),
    );
    this.apply(settings);
  }

  apply(settings: OrganizationSettingsDto) {
    this.settings.set(settings);
    document.title = settings.name;

    const accent = settings.accentColor || DEFAULTS.accentColor!;
    const root = document.documentElement.style;
    root.setProperty('--brand-accent', accent);
    root.setProperty('--brand-accent-strong', `color-mix(in srgb, ${accent} 85%, black)`);
    root.setProperty('--brand-accent-soft', `color-mix(in srgb, ${accent} 16%, white)`);
    root.setProperty('--mat-sys-on-primary', readableTextOn(accent));
  }
}

/**
 * Textfarbe auf der Akzentfarbe: Weiß wie im bisherigen Design, dunkel nur bei wirklich hellen
 * Farben (Kontrast zu Weiß unter 2,2:1, z. B. Gelb), damit Beschriftungen lesbar bleiben.
 */
export function readableTextOn(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05) >= 2.2 ? '#ffffff' : '#17120a';
}
