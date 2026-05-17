import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (!authService.isLoaded()) {
    await authService.loadCurrentUser();
  }

  if (!authService.isLoggedIn()) {
    await router.navigate(['/login']);
    return false;
  }

  return true;
};

export const setup2faGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isLoaded()) await auth.loadCurrentUser();

  if (auth.requires2faSetup()) {
    await router.navigate(['/setup-2fa']);
    return false;
  }

  return true;
};

export const permissionGuard =
  (...permissions: string[]): CanActivateFn =>
  async () => {
    const authService = inject(Auth);
    const router = inject(Router);

    if (!authService.isLoaded()) {
      await authService.loadCurrentUser();
    }

    if (!authService.isLoggedIn()) {
      await router.navigate(['/login']);
      return false;
    }

    if (!authService.hasAnyPermission(...permissions)) {
      await router.navigate(['/forbidden']);
      return false;
    }

    return true;
  };
