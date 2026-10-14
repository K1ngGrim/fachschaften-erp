import { Component, computed, DestroyRef, effect, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { Auth } from '../../../../../core/services/auth';
import { AppModule, Modules } from '../../../../../core/services/modules';
import { PermissionType } from '../../../../../shared/models/permission-type';

interface SettingsItem {
  label: string;
  route: string;
  icon: string;
  permission: PermissionType;
  module?: string;
}

interface SettingsGroup {
  label: string;
  items: SettingsItem[];
}

/** Alle Bereiche der Einstellungen; die erste sichtbare Seite ist die Startseite. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Allgemein',
    items: [
      {
        label: 'Erscheinungsbild',
        route: 'design',
        icon: 'palette-outline',
        permission: PermissionType.SettingsCanWrite,
      },
      {
        label: 'Datenschutz',
        route: 'privacy',
        icon: 'shield-account-outline',
        permission: PermissionType.SettingsCanWrite,
      },
      {
        label: 'Module',
        route: 'modules',
        icon: 'puzzle-outline',
        permission: PermissionType.SettingsCanWrite,
      },
    ],
  },
  {
    label: 'Daten',
    items: [
      {
        label: 'Backup',
        route: 'backup',
        icon: 'cloud-upload-outline',
        permission: PermissionType.SettingsCanWrite,
      },
      {
        label: 'Verschlüsselung',
        route: 'encryption',
        icon: 'key-variant',
        permission: PermissionType.SettingsCanWrite,
      },
    ],
  },
  {
    label: 'Dokumente',
    items: [
      {
        label: 'Gemeinsame Dateien',
        route: 'document-files',
        icon: 'folder-multiple-outline',
        permission: PermissionType.DocumentTemplatesCanWrite,
        module: AppModule.Documents,
      },
      {
        label: 'Variablen',
        route: 'document-variables',
        icon: 'code-braces',
        permission: PermissionType.DocumentTemplatesCanWrite,
        module: AppModule.Documents,
      },
    ],
  },
];

/** Einstellungen mit eigener Navigation links; die Bereiche sind Unterseiten. */
@Component({
  selector: 'app-settings-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIcon, PageHeader],
  templateUrl: './settings-layout.html',
  styleUrl: './settings-layout.scss',
})
export class SettingsLayout {
  private readonly auth = inject(Auth);
  private readonly modules = inject(Modules);

  protected readonly groups = computed(() =>
    SETTINGS_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.filter(
        (item) =>
          this.auth.hasPermission(item.permission) &&
          (!item.module || this.modules.enabled().has(item.module)),
      ),
    })).filter((group) => group.items.length),
  );

  constructor() {
    void this.modules.load();

    // Auf schmalen Bildschirmen ist die Navigation eine waagrechte Leiste: aktiven Bereich zeigen.
    const host = inject(ElementRef<HTMLElement>);
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => setTimeout(() => this.revealActive(host.nativeElement)));
    // Bereiche erscheinen teils erst nach dem Laden der Module.
    effect(() => {
      this.groups();
      setTimeout(() => this.revealActive(host.nativeElement), 50);
    });
  }

  /** Nur die Leiste waagrecht verschieben (nicht die Seite), damit der aktive Bereich mittig steht. */
  private revealActive(host: HTMLElement) {
    const nav = host.querySelector<HTMLElement>('.settings-nav');
    const active = host.querySelector<HTMLElement>('.settings-link.active');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = active.getBoundingClientRect();
    nav.scrollLeft += linkBox.left - navBox.left - (navBox.width - linkBox.width) / 2;
  }
}
