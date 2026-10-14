import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { lastValueFrom } from 'rxjs';
import { SettingsService } from '../../../../../../../projects/api/src/lib';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Organization, readableTextOn } from '../../../../../core/services/organization';

const MAX_LOGO_BYTES = 256 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

import { RecoveryKeyCard } from '../recovery-key-card/recovery-key-card';
import { BackupCard } from '../backup-card/backup-card';

@Component({
  selector: 'app-settings-page',
  imports: [
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    PageHeader,
    RecoveryKeyCard,
    BackupCard,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {
  private readonly settingsController = inject(SettingsService);
  private readonly organization = inject(Organization);

  public readonly name = signal('');
  public readonly subtitle = signal('');
  public readonly accentColor = signal('#e8912a');
  public readonly logoDataUrl = signal<string | null>(null);
  public readonly privacyContact = signal('');
  public readonly imprintUrl = signal('');

  public readonly saving = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly info = signal<string | null>(null);

  public readonly colorValid = computed(() => HEX_COLOR.test(this.accentColor()));
  public readonly previewText = computed(() =>
    this.colorValid() ? readableTextOn(this.accentColor()) : '#ffffff',
  );
  public readonly canSave = computed(
    () => !!this.name().trim() && this.colorValid() && !this.saving(),
  );

  ngOnInit() {
    const s = this.organization.settings();
    this.name.set(s.name);
    this.subtitle.set(s.subtitle ?? '');
    this.accentColor.set(s.accentColor ?? '#e8912a');
    this.logoDataUrl.set(s.logoDataUrl ?? null);
    this.privacyContact.set(s.privacyContact ?? '');
    this.imprintUrl.set(s.imprintUrl ?? '');
  }

  public onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error.set(null);
    if (!LOGO_TYPES.includes(file.type)) {
      this.error.set('Bitte ein PNG-, JPG-, WebP- oder SVG-Bild wählen.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.error.set('Das Logo darf höchstens 256 KB groß sein.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.logoDataUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  public async save() {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const saved = await lastValueFrom(
        this.settingsController.apiSettingsOrganizationPut({
          organizationSettingsDto: {
            name: this.name().trim(),
            subtitle: this.subtitle().trim() || null,
            accentColor: this.accentColor().toLowerCase(),
            logoDataUrl: this.logoDataUrl(),
            privacyContact: this.privacyContact().trim() || null,
            imprintUrl: this.imprintUrl().trim() || null,
          },
        }),
      );
      this.organization.apply(saved);
      this.info.set('Einstellungen gespeichert.');
    } catch {
      this.error.set('Die Einstellungen konnten nicht gespeichert werden. Bitte Eingaben prüfen.');
    } finally {
      this.saving.set(false);
    }
  }
}
