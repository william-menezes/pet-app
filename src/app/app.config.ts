import {
  ApplicationConfig,
  ErrorHandler,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { FaroPreset } from '../theme/faro-preset';
import { GlobalErrorHandler } from './core/error/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless: detecção de mudança por signals (sem zone.js). Ver docs/frontend.md.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Roteamento. `withComponentInputBinding` entrega params de rota (ex.: :codigo) como inputs.
    provideRouter(routes, withComponentInputBinding()),

    // SSR híbrido: hidratação incremental (mantém o painel longe da rota pública) +
    // event replay (não perde o clique no CTA de resgate antes da hidratação).
    provideClientHydration(withIncrementalHydration(), withEventReplay()),

    // Tema PrimeNG (Aura via FaroPreset, Paleta C). PrimeNG isolado em @layer primeng;
    // faro-ds.css (unlayered) sobrepõe quando precisa. darkMode via classe .faro-dark.
    providePrimeNG({
      theme: {
        preset: FaroPreset,
        options: {
          darkModeSelector: '.faro-dark',
          cssLayer: { name: 'primeng', order: 'primeng' },
        },
      },
    }),

    // PWA: service worker só fora de dev.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
