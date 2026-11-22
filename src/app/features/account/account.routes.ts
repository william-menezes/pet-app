import type { Routes } from '@angular/router';

/**
 * Rotas de `/app/conta/*` (filhas da rota `app`, hospedeiro `TutorApp`). As telas internas ainda não
 * existentes (dados, celular, senha, aparência: Phase 8) caem no `**` do `ShellFallback` da rota `app`.
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./account-home/account-home').then((m) => m.AccountHome),
    data: { hub: true },
    title: 'Conta — Faro',
  },
];
