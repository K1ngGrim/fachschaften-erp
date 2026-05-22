import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private count = signal(0);
  public readonly isLoading = computed(() => this.count() > 0);

  public increment() {
    this.count.update((c) => c + 1);
  }
  public decrement() {
    this.count.update((c) => Math.max(0, c - 1));
  }
  public reset() {
    this.count.set(0);
  }
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  if (!isMutation) return next(req);

  loading.increment();
  return next(req).pipe(finalize(() => loading.decrement()));
};
