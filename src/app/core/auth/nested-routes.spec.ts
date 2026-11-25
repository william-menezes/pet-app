/**
 * nested-routes.spec.ts — T027/T028 (spec 004)
 *
 * Os guards recebem `segments` relativos à rota que os declara. Numa rota filha de `auth`, o guard
 * vê só `[termos]`. Este teste roda o roteador de verdade com a mesma forma de `app.routes.ts` para
 * garantir que o `returnUrl` calculado é sempre o caminho completo.
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AccountService } from '../account/account.service';
import type { Account } from '../account/account.store';
import { anonGuard } from './anon.guard';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';
import { termsGuard } from './terms.guard';

@Component({ template: '' })
class Stub {}

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'a@x.com',
  papel: 'tutor',
  celular: null,
  celularConfirmadoEm: null,
  celularPendente: null,
  termosAceitosEm: null,
  termosVersao: null,
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

describe('guards com rotas aninhadas (roteador real)', () => {
  let router: Router;
  let store: AuthStore;

  const setup = (acc: Account | null) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'app',
            canMatch: [authGuard, termsGuard],
            component: Stub,
            children: [{ path: '**', component: Stub }],
          },
          {
            path: 'auth',
            children: [
              { path: 'login', canMatch: [anonGuard], component: Stub },
              { path: 'termos', canMatch: [authGuard], component: Stub },
              { path: 'celular', canMatch: [authGuard, termsGuard], component: Stub },
              { path: '', component: Stub },
            ],
          },
          { path: ':codigo', component: Stub },
        ]),
        { provide: AccountService, useValue: { ensureLoaded: () => Promise.resolve(acc) } },
      ],
    });
    router = TestBed.inject(Router);
    store = TestBed.inject(AuthStore);
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sem sessão, /app/conta => /auth?returnUrl=/app/conta', async () => {
    setup(null);
    await router.navigateByUrl('/app/conta');
    expect(router.url).toBe('/auth?returnUrl=%2Fapp%2Fconta');
  });

  it('sem sessão e com marca, /app/conta => login com session_expired', async () => {
    localStorage.setItem('faro.returning', '1');
    setup(null);
    await router.navigateByUrl('/app/conta');
    expect(router.url).toBe('/auth/login?returnUrl=%2Fapp%2Fconta&reason=session_expired');
  });

  it('sem sessão, /auth/termos não guarda um returnUrl enganoso', async () => {
    setup(null);
    await router.navigateByUrl('/auth/termos');
    expect(router.url).toBe('/auth');
  });

  it('sem sessão, /auth/celular não guarda um returnUrl enganoso', async () => {
    setup(null);
    await router.navigateByUrl('/auth/celular');
    expect(router.url).toBe('/auth');
  });

  it('tutor sem aceite, /app/conta => /auth/termos?returnUrl=/app/conta', async () => {
    setup(account());
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    await router.navigateByUrl('/app/conta');
    expect(router.url).toBe('/auth/termos?returnUrl=%2Fapp%2Fconta');
  });

  it('tutor sem aceite, /auth/celular => /auth/termos sem returnUrl dentro de /auth', async () => {
    setup(account());
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    await router.navigateByUrl('/auth/celular');
    expect(router.url).toBe('/auth/termos');
  });

  it('preserva a query do destino', async () => {
    setup(null);
    await router.navigateByUrl('/app/conta?aba=1');
    expect(router.url).toBe('/auth?returnUrl=%2Fapp%2Fconta%3Faba%3D1');
  });

  it('tutor com aceite abre /app', async () => {
    setup(account({ termosAceitosEm: '2026-11-21T11:00:00Z' }));
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    await router.navigateByUrl('/app');
    expect(router.url).toBe('/app');
  });

  it('logado em /auth/login => anonGuard leva para /app', async () => {
    setup(account({ termosAceitosEm: '2026-11-21T11:00:00Z' }));
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    await router.navigateByUrl('/auth/login');
    expect(router.url).toBe('/app');
  });
});
