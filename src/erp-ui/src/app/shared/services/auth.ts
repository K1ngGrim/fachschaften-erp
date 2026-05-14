import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, lastValueFrom, of } from 'rxjs';
import { AuthService } from '../../../../projects/api/src/lib';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private authController = inject(AuthService);
  private currentUser = signal<MeDto | null>(null);
  isLoaded = signal(false);

  isLoggedIn = computed(() => this.currentUser() !== null);
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

export interface MeDto {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  permissions: string[];
}
