import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AccountService } from '../account/account.service';
import type { Account } from '../account/account.store';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthStore } from './auth.store';
import { NextStepInput, PostAuthNavigator, nextStep } from './post-auth-navigation';
import { ReturnUrlService } from './return-url';
import { isReturning } from './returning-visitor';

const base: NextStepInput = {
  role: 'tutor',
  termsAccepted: true,
  phoneConfirmed: true,
  returnUrl: null,
  skipPhone: false,
};

describe('nextStep (tabela do contrato §3)', () => {
  it('admin com /admin/lotes => /admin/lotes', () => {
    expect(nextStep({ ...base, role: 'admin', returnUrl: '/admin/lotes' })).toBe('/admin/lotes');
  });

  it('admin com /app ou sem destino => /admin, qualquer aceite e celular', () => {
    const open = { termsAccepted: false, phoneConfirmed: false };
    expect(nextStep({ ...base, ...open, role: 'admin', returnUrl: '/app' })).toBe('/admin');
    expect(nextStep({ ...base, ...open, role: 'admin', returnUrl: null })).toBe('/admin');
  });

  it('tutor sem aceite => /auth/termos com returnUrl (sem query se não há destino)', () => {
    expect(nextStep({ ...base, termsAccepted: false, returnUrl: '/app/conta' })).toBe(
      '/auth/termos?returnUrl=%2Fapp%2Fconta',
    );
    expect(nextStep({ ...base, termsAccepted: false })).toBe('/auth/termos');
  });

  it('papel nulo se comporta como tutor', () => {
    expect(nextStep({ ...base, role: null, termsAccepted: false })).toBe('/auth/termos');
  });

  it('com aceite, sem celular e sem adiar => /auth/celular', () => {
    expect(nextStep({ ...base, phoneConfirmed: false, returnUrl: '/app/conta' })).toBe(
      '/auth/celular?returnUrl=%2Fapp%2Fconta',
    );
    expect(nextStep({ ...base, phoneConfirmed: false })).toBe('/auth/celular');
  });

  it('com aceite, sem celular e adiado => destino ou /app', () => {
    expect(nextStep({ ...base, phoneConfirmed: false, skipPhone: true, returnUrl: '/app/x' })).toBe(
      '/app/x',
    );
    expect(nextStep({ ...base, phoneConfirmed: false, skipPhone: true })).toBe('/app');
  });

  it('com aceite e celular => destino ou /app', () => {
    expect(nextStep({ ...base, returnUrl: '/app/conta' })).toBe('/app/conta');
    expect(nextStep({ ...base })).toBe('/app');
  });

  it('tutor com destino /admin => /app', () => {
    expect(nextStep({ ...base, returnUrl: '/admin' })).toBe('/app');
    expect(nextStep({ ...base, returnUrl: '/admin/lotes' })).toBe('/app');
  });
});

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'a@x.com',
  papel: 'tutor',
  celular: '+5511987654421',
  celularConfirmadoEm: '2026-11-21T12:00:00Z',
  celularPendente: null,
  termosAceitosEm: '2026-11-21T11:00:00Z',
  termosVersao: '2026-11',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

describe('PostAuthNavigator.go', () => {
  let load: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let updateUser: ReturnType<typeof vi.fn>;
  let nav: PostAuthNavigator;
  let authStore: AuthStore;
  let returnUrl: ReturnUrlService;

  const setup = (acc: Account | null, role: 'tutor' | 'admin' | null = 'tutor') => {
    load = vi.fn().mockResolvedValue(acc);
    navigateByUrl = vi.fn().mockResolvedValue(true);
    updateUser = vi.fn().mockResolvedValue({ error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { load } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: SupabaseService, useValue: { client: { auth: { updateUser } } } },
      ],
    });
    authStore = TestBed.inject(AuthStore);
    authStore.setRole(role);
    returnUrl = TestBed.inject(ReturnUrlService);
    nav = TestBed.inject(PostAuthNavigator);
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('recarrega a conta (force) e navega com replaceUrl', async () => {
    setup(account());
    await nav.go();
    expect(load).toHaveBeenCalledWith(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('marca o visitante que volta', async () => {
    setup(account());
    await nav.go();
    expect(TestBed.runInInjectionContext(() => isReturning())).toBe(true);
  });

  it('limpa o destino só no passo final', async () => {
    setup(account({ termosAceitosEm: null }));
    returnUrl.capture('/app/conta');
    await nav.go();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/auth/termos?returnUrl=%2Fapp%2Fconta', {
      replaceUrl: true,
    });
    expect(returnUrl.peek()).toBe('/app/conta');
  });

  it('o passo final consome o destino guardado', async () => {
    setup(account());
    returnUrl.capture('/app/conta');
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app/conta', { replaceUrl: true });
    expect(returnUrl.peek()).toBeNull();
  });

  it('skipPhone leva ao destino mesmo sem celular confirmado', async () => {
    setup(account({ celular: null, celularConfirmadoEm: null }));
    await nav.go({ skipPhone: true });
    expect(navigateByUrl).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('admin vai para /admin', async () => {
    setup(account({ papel: 'admin' }), 'admin');
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/admin', { replaceUrl: true });
  });

  it('usa return_to dos metadados e depois o limpa', async () => {
    setup(account());
    authStore.setSession({
      user: {
        id: 'u1',
        user_metadata: { return_to: '/app/conta', return_to_at: new Date().toISOString() },
      },
    } as never);
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app/conta', { replaceUrl: true });
    expect(updateUser).toHaveBeenCalledWith({ data: { return_to: null, return_to_at: null } });
  });

  it('não limpa os metadados quando o passo ainda não é o final', async () => {
    setup(account({ termosAceitosEm: null }));
    authStore.setSession({
      user: {
        id: 'u1',
        user_metadata: { return_to: '/app/conta', return_to_at: new Date().toISOString() },
      },
    } as never);
    await nav.go();
    expect(updateUser).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/termos?returnUrl=%2Fapp%2Fconta', {
      replaceUrl: true,
    });
  });

  it('ignora return_to com mais de 7 dias', async () => {
    setup(account());
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    authStore.setSession({
      user: { id: 'u1', user_metadata: { return_to: '/app/conta', return_to_at: old } },
    } as never);
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('ignora return_to sem data', async () => {
    setup(account());
    authStore.setSession({
      user: { id: 'u1', user_metadata: { return_to: '/app/conta' } },
    } as never);
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('ignora return_to que sanitizeReturnUrl reprova', async () => {
    setup(account());
    authStore.setSession({
      user: {
        id: 'u1',
        user_metadata: { return_to: 'https://evil.com', return_to_at: new Date().toISOString() },
      },
    } as never);
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('conta que não carregou: não aplica aceite nem celular', async () => {
    setup(null);
    returnUrl.capture('/app/conta');
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/app/conta', { replaceUrl: true });
  });

  it('conta que não carregou e sem destino: casa do papel', async () => {
    setup(null, 'admin');
    await nav.go();
    expect(navigateByUrl).toHaveBeenCalledWith('/admin', { replaceUrl: true });
  });

  it('erro ao limpar os metadados não impede a navegação', async () => {
    setup(account());
    updateUser.mockRejectedValue(new Error('x'));
    authStore.setSession({
      user: {
        id: 'u1',
        user_metadata: { return_to: '/app/conta', return_to_at: new Date().toISOString() },
      },
    } as never);
    await expect(nav.go()).resolves.toBe(true);
  });
});
