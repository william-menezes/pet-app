import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { AccountService } from '../account/account.service';
import type { Account } from '../account/account.store';
import { AuthStore } from './auth.store';
import { termsGuard } from './terms.guard';

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

describe('termsGuard', () => {
  let ensureLoaded: ReturnType<typeof vi.fn>;
  let store: AuthStore;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      termsGuard({ path: 'app' } as never, [{ path: 'app' }, { path: 'conta' }] as never),
    ) as Promise<boolean | UrlTree>;

  const setup = (result: Account | null) => {
    ensureLoaded = vi.fn().mockResolvedValue(result);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AccountService, useValue: { ensureLoaded } }],
    });
    store = TestBed.inject(AuthStore);
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
  };

  it('tutor sem aceite => /auth/termos?returnUrl=<rota>', async () => {
    setup(account());
    const result = (await run()) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/auth/termos?returnUrl=%2Fapp%2Fconta');
  });

  it('tutor com aceite => true', async () => {
    setup(account({ termosAceitosEm: '2026-11-21T11:00:00Z' }));
    expect(await run()).toBe(true);
  });

  it('admin => true, mesmo sem aceite', async () => {
    setup(account({ papel: 'admin' }));
    store.setRole('admin');
    expect(await run()).toBe(true);
  });

  it('falha ao carregar a conta => true (a RLS protege os dados)', async () => {
    setup(null);
    expect(await run()).toBe(true);
  });

  it('sem sessão => true e não consulta a conta (quem decide é o authGuard)', async () => {
    setup(account());
    store.setSession(null);
    expect(await run()).toBe(true);
    expect(ensureLoaded).not.toHaveBeenCalled();
  });
});
