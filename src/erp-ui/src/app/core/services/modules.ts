import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ModuleDto, ModulesService } from '../../../../projects/api/src/lib';
import { Auth } from './auth';

/** Schlüssel der optionalen Module (wie AppModules im Backend). */
export const AppModule = {
  Documents: 'documents',
} as const;

/** Welche optionalen Module eingeschaltet sind; steuert Navigation und Routen. */
@Injectable({ providedIn: 'root' })
export class Modules {
  private readonly modulesController = inject(ModulesService);
  private readonly auth = inject(Auth);
  private loading: Promise<void> | null = null;

  public readonly list = signal<ModuleDto[]>([]);
  public readonly enabled = computed<ReadonlySet<string>>(
    () =>
      new Set(
        this.list()
          .filter((m) => m.enabled)
          .map((m) => m.key),
      ),
  );

  constructor() {
    // Nach Benutzerwechsel neu laden (vor dem Login liefert die API nichts).
    effect(() => {
      this.auth.userId();
      this.loading = null;
    });
  }

  public load(): Promise<void> {
    this.loading ??= lastValueFrom(this.modulesController.apiModulesGet())
      .then((modules) => this.list.set(modules))
      .catch(() => {
        this.loading = null;
      });
    return this.loading;
  }

  public isEnabled(key: string): boolean {
    return this.enabled().has(key);
  }

  public async setEnabled(key: string, enabled: boolean) {
    const updated = await lastValueFrom(
      this.modulesController.apiModulesKeyPut({ key, setModuleEnabledRequest: { enabled } }),
    );
    this.list.update((modules) => modules.map((m) => (m.key === key ? updated : m)));
  }
}
