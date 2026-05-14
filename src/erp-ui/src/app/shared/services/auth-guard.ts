import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from './auth';

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
