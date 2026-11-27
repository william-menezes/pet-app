/**
 * T042: o guard da ativação, rodando num roteador real com a mesma ordem de guards de `app.routes.ts`
 * (`activationGuard`, `authGuard`, `termsGuard`, `phoneConfirmedGuard`).
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AccountService } from '../account/account.service';
import type { Account } from '../account/account.store';
import { phoneConfirmedGuard } from '../account/phone-confirmed.guard';
import { authGuard } from '../auth/auth.guard';
import { AuthStore } from '../auth/auth.store';
import { termsGuard } from '../auth/terms.guard';
import { activationPath, phoneConfirmationRoute, withPetParam } from './activation-links';
import { activationGuard } from './activation.guard';
import { TagService } from './tag.service';

@Component({ template: '' })
class Stub {}

// Código sintético do contrato, válido pela regra do dígito.
const CODE = '7K3M-Q9XA-C';
const NORMALIZED = '7K3MQ9XAC';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'a@x.com',
  papel: 'tutor',
  celular: '+5511987654321',
  celularConfirmadoEm: '2026-11-21T11:00:00Z',
  celularPendente: null,
  termosAceitosEm: '2026-11-21T11:00:00Z',
  termosVersao: '1',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

describe('activationGuard (roteador real)', () => {
  let router: Router;
  let store: AuthStore;
  let setPending: ReturnType<typeof vi.fn>;

  const setup = (acc: Account | null) => {
    setPending = vi.fn().mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'ativar/:code',
            canMatch: [activationGuard, authGuard, termsGuard, phoneConfirmedGuard],
            component: Stub,
          },
          {
            path: 'auth',
            children: [
              { path: 'criar-conta', component: Stub },
              { path: 'celular', component: Stub },
              { path: 'termos', component: Stub },
              { path: '', component: Stub },
            ],
          },
          { path: '**', component: Stub },
        ]),
        { provide: AccountService, useValue: { ensureLoaded: () => Promise.resolve(acc) } },
        { provide: TagService, useValue: { setPendingActivation: setPending } },
      ],
    });
    router = TestBed.inject(Router);
    store = TestBed.inject(AuthStore);
  };
  const login = () => {
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sem sessão: /auth/criar-conta?returnUrl=/ativar/<código normalizado>, e nada é guardado', async () => {
    setup(null);
    await router.navigateByUrl(`/ativar/${CODE}`);
    expect(router.url).toBe(`/auth/criar-conta?returnUrl=%2Fativar%2F${NORMALIZED}`);
    expect(setPending).not.toHaveBeenCalled();
  });

  it('sem sessão e código digitado em minúsculas e com espaço: o mesmo endereço', async () => {
    setup(null);
    await router.navigateByUrl('/ativar/7k3m-q9xa-c');
    expect(router.url).toBe(`/auth/criar-conta?returnUrl=%2Fativar%2F${NORMALIZED}`);
  });

  it('com sessão: guarda o código normalizado e abre a ativação', async () => {
    setup(account());
    login();
    await router.navigateByUrl(`/ativar/${CODE}`);
    expect(setPending).toHaveBeenCalledWith(NORMALIZED);
    expect(router.url).toBe(`/ativar/${CODE}`);
  });

  it('com sessão e a RPC falhando: abre a ativação do mesmo jeito', async () => {
    setup(account());
    login();
    setPending.mockResolvedValue({ ok: false, error: 'network' });
    await router.navigateByUrl(`/ativar/${CODE}`);
    expect(router.url).toBe(`/ativar/${CODE}`);
  });

  it('com sessão e celular sem confirmar: /auth/celular?returnUrl=/ativar/<código>', async () => {
    setup(account({ celular: null, celularConfirmadoEm: null }));
    login();
    await router.navigateByUrl(`/ativar/${CODE}`);
    expect(router.url).toBe(`/auth/celular?returnUrl=%2Fativar%2F${encodeURIComponent(CODE)}`);
  });

  it('código com dígito errado: não guarda nada e a tela decide (com sessão, abre)', async () => {
    setup(account());
    login();
    await router.navigateByUrl('/ativar/7K3M-Q9XA-D');
    expect(setPending).not.toHaveBeenCalled();
    expect(router.url).toBe('/ativar/7K3M-Q9XA-D');
  });

  it('código com dígito errado e sem sessão: segue para a entrada, sem criar-conta', async () => {
    setup(null);
    await router.navigateByUrl('/ativar/7K3M-Q9XA-D');
    expect(router.url).toMatch(/^\/auth\?returnUrl=/);
  });
});

describe('activation-links', () => {
  it('activationPath normaliza e leva o pet', () => {
    expect(activationPath(CODE)).toBe(`/ativar/${NORMALIZED}`);
    expect(activationPath('7k3m q9xa c', 'p 1')).toBe(`/ativar/${NORMALIZED}?pet=p%201`);
  });

  it('phoneConfirmationRoute leva só a volta', () => {
    expect(phoneConfirmationRoute('/ativar/X?pet=1')).toEqual({
      commands: ['/auth/celular'],
      queryParams: { returnUrl: '/ativar/X?pet=1' },
    });
  });

  it('withPetParam troca o pet antigo e recusa destino externo', () => {
    expect(withPetParam('/ativar/ABC', 'p1')).toBe('/ativar/ABC?pet=p1');
    expect(withPetParam('/ativar/ABC?pet=velho&x=1', 'p2')).toBe('/ativar/ABC?pet=p2&x=1');
    expect(withPetParam('//evil.com/x', 'p')).toBeNull();
    expect(withPetParam('https://evil.com', 'p')).toBeNull();
  });
});
