import {
  ApplicationConfig,
  ErrorHandler,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';
import { bootstrapSession } from './core/session/session-bootstrap';
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

    // SSR híbrido: hidratação PURA (T034A). Sem withEventReplay() e sem withIncrementalHydration() (esta liga
    // o replay por conta própria): o replay embute <script> que a CSP (script-src 'self') bloqueia, e a
    // CSP não se afrouxa. O botão principal da página da tag é um link e funciona sem JavaScript.
    provideClientHydration(),

    // Restaura a sessão do Supabase antes do roteador (só no navegador e só se houver sessão
    // gravada; sem ela nada é importado). Ver core/session/session-bootstrap.ts.
    provideAppInitializer(() => bootstrapSession()),

    provideZard(),

    // Ícones do Faro (Boxicons sob nomes do Faro). Ver shared/icons/faro-icons.ts.
    provideIcons(faroIcons),
  ],
};
