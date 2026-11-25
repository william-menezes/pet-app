import type { Routes } from '@angular/router';

/** Rotas de `/app/conta/*` (filhas da rota `app`, hospedeiro `TutorApp`). */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./account-home/account-home').then((m) => m.AccountHome),
    data: { hub: true },
    title: $localize`Conta — Faro`,
  },
  {
    path: 'dados',
    loadComponent: () => import('./personal-data/personal-data').then((m) => m.PersonalData),
    title: $localize`Dados pessoais — Faro`,
  },
  {
    path: 'celular',
    loadComponent: () => import('./phone/phone').then((m) => m.AccountPhone),
    title: $localize`Celular — Faro`,
  },
  {
    path: 'senha',
    loadComponent: () => import('./password/password').then((m) => m.AccountPassword),
    title: $localize`Senha — Faro`,
  },
  {
    path: 'aparencia',
    loadComponent: () => import('./appearance/appearance').then((m) => m.AccountAppearance),
    title: $localize`Aparência — Faro`,
  },
  {
    path: 'privacidade',
    loadComponent: () => import('./privacy/privacy').then((m) => m.Privacy),
    title: $localize`Privacidade — Faro`,
  },
];
