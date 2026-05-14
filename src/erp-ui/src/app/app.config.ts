import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { BASE_PATH } from '../../projects/api/src/lib';
import { Auth } from './shared/services/auth';

registerLocaleData(localeDe);

const initAppFn = async () => {
  const auth = inject(Auth);
  await auth.loadCurrentUser();
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // provideClientHydration(withEventReplay()), weil kein ssr
    provideHttpClient(
      withFetch(),
      withInterceptors([
        (req, next) => next(req.clone({ withCredentials: true })),
      ]),
    ),
    { provide: BASE_PATH, useValue: '' },
    provideAppInitializer(initAppFn),
  ],
};
