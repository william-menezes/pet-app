import {
  ApplicationConfig,
  ErrorHandler,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';

import { routes } from './app.routes';
import { bootstrapSession } from './core/auth/session-bootstrap';
import { GlobalErrorHandler } from './core/error/global-error-handler';
import { provideZard } from '@/shared/core/provider/providezard';
import { provideIcons } from '@ng-icons/core';
import { faroIcons } from './shared/icons/faro-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless: detecção de mudança por signals (sem zone.js).
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Roteamento. `withComponentInputBinding` entrega params de rota (ex.: :codigo) como inputs.
    provideRouter(routes, withComponentInputBinding()),

    // SSR híbrido: hidratação incremental (mantém o painel longe da rota pública) +
    // event replay (não perde o clique no CTA de resgate antes da hidratação).
    provideClientHydration(withIncrementalHydration(), withEventReplay()),

    // Restaura a sessão do Supabase antes do roteador (só no navegador e só se houver sessão
    // gravada; sem ela nada é importado). Ver core/auth/session-bootstrap.ts.
    provideAppInitializer(() => bootstrapSession()),

    provideZard(),

    // Ícones do Faro (Boxicons sob nomes do Faro). Ver shared/icons/faro-icons.ts.
    provideIcons(faroIcons),
  ],
};
