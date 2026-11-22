import type { Routes } from '@angular/router';

/** Rotas de `/app/conta/*` (filhas da rota `app`, hospedeiro `TutorApp`). */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./account-home/account-home').then((m) => m.AccountHome),
    data: { hub: true },
    title: 'Conta — Faro',
  },
  {
    path: 'dados',
    loadComponent: () => import('./personal-data/personal-data').then((m) => m.PersonalData),
    title: 'Dados pessoais — Faro',
  },
  {
    path: 'celular',
    loadComponent: () => import('./phone/phone').then((m) => m.AccountPhone),
    title: 'Celular — Faro',
  },
  {
    path: 'senha',
    loadComponent: () => import('./password/password').then((m) => m.AccountPassword),
    title: 'Senha — Faro',
  },
  {
    path: 'aparencia',
    loadComponent: () => import('./appearance/appearance').then((m) => m.AccountAppearance),
    title: 'Aparência — Faro',
  },
  {
    path: 'privacidade',
    loadComponent: () => import('./privacy/privacy').then((m) => m.Privacy),
    title: 'Privacidade — Faro',
  },
];
