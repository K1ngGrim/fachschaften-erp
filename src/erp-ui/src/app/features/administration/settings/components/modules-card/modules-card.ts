import { Component, inject, OnInit, signal } from '@angular/core';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { Modules } from '../../../../../core/services/modules';

/** Optionale Module ein- und ausschalten. */
@Component({
  selector: 'app-modules-card',
  imports: [MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatSlideToggle],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-2">
        <mat-card-title class="fs-6">Module</mat-card-title>
      </mat-card-header>
      <mat-card-content class="d-flex flex-column gap-3">
        <p class="small mb-0">
          Zusätzliche Bereiche, die ihr nur bei Bedarf einschaltet. Ausgeschaltet verschwinden sie
          aus der Navigation; ihre Daten bleiben erhalten.
        </p>
        @for (module of modules.list(); track module.key) {
          <div class="d-flex flex-column gap-1">
            <mat-slide-toggle
              [checked]="module.enabled"
              [disabled]="busy() === module.key"
              (change)="toggle(module.key, $event.checked)"
            >
              {{ module.name }}
            </mat-slide-toggle>
            <small class="text-hint">{{ module.description }}</small>
          </div>
        }
        @if (error(); as message) {
          <p class="text-negative small mb-0">{{ message }}</p>
        }
      </mat-card-content>
    </mat-card>
  `,
})
export class ModulesCard implements OnInit {
  protected readonly modules = inject(Modules);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit() {
    await this.modules.load();
  }

  protected async toggle(key: string, enabled: boolean) {
    this.busy.set(key);
    this.error.set(null);
    try {
      await this.modules.setEnabled(key, enabled);
    } catch {
      this.error.set('Das Modul konnte nicht umgeschaltet werden.');
    } finally {
      this.busy.set(null);
    }
  }
}
