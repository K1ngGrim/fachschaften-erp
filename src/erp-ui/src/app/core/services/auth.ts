import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, lastValueFrom, of } from 'rxjs';
import { AuthService, MeDto } from '../../../../projects/api/src/lib';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private authController = inject(AuthService);
  private currentUser = signal<MeDto | null>(null);
  isLoaded = signal(false);

  isLoggedIn = computed(() => this.currentUser() !== null);

  readonly userName = computed(() => this.currentUser()?.userName ?? '');

  /** Kürzel für den Avatar in der Kopfleiste. */
  readonly initials = computed(() => {
    const name = this.userName().trim();
    if (!name) return '?';

    const parts = name.split(/[\s._@-]+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();

    return name.substring(0, 2).toUpperCase();
  });
  private permissions = computed(() => this.currentUser()?.permissions ?? []);
  private roles = computed(() => this.currentUser()?.roles ?? []);

  private loadingPromise: Promise<void> | null = null;

  async loadCurrentUser(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise; // ← kein Doppel-Request

    this.loadingPromise = lastValueFrom(
      this.authController.apiAuthMeGet().pipe(catchError(() => of(null))),
    ).then((user) => {
      this.currentUser.set(user ?? null);
      this.isLoaded.set(true);
    });

    return this.loadingPromise;
  }

  requires2faSetup = computed(
    () => this.currentUser()?.claims?.includes('2fa-setup-required') ?? false,
  );

  refresh(): Promise<void> {
    this.loadingPromise = null; // ← Reset
    return this.loadCurrentUser();
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAnyPermission(...perms: string[]): boolean {
    return perms.some((p) => this.permissions().includes(p));
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  async logout(): Promise<void> {
    await lastValueFrom(this.authController.apiAuthLogoutPost());
    this.currentUser.set(null);
  }
}
