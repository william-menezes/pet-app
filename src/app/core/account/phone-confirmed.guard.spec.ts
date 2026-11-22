import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { AccountService } from './account.service';
import type { Account } from './account.store';
import { phoneConfirmedGuard } from './phone-confirmed.guard';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'a@x.com',
  papel: 'tutor',
  celular: null,
  celularConfirmadoEm: null,
  celularPendente: null,
  termosAceitosEm: '2026-11-21T11:00:00Z',
  termosVersao: '2026-11',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

describe('phoneConfirmedGuard', () => {
  let ensureLoaded: ReturnType<typeof vi.fn>;
  let store: AuthStore;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      phoneConfirmedGuard({ path: 'ativar' } as never, [{ path: 'ativar' }, { path: '7K3M-Q9XA-C' }] as never),
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

  it('celular confirmado => true', async () => {
    setup(account({ celular: '+5511987654421', celularConfirmadoEm: '2026-11-21T12:00:00Z' }));
    expect(await run()).toBe(true);
  });

  it('admin => true, mesmo sem celular', async () => {
    setup(account({ papel: 'admin' }));
    store.setRole('admin');
    expect(await run()).toBe(true);
  });

  it('não confirmado => /auth/celular?returnUrl=<rota>', async () => {
    setup(account({ celularPendente: '+5511987654421' }));
    const result = (await run()) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/auth/celular?returnUrl=%2Fativar%2F7K3M-Q9XA-C');
  });

  it('número sem data de confirmação não conta como confirmado', async () => {
    setup(account({ celular: '+5511987654421', celularConfirmadoEm: null }));
    expect(await run()).toBeInstanceOf(UrlTree);
  });

  it('falha ao carregar a conta => true (a regra de verdade está no banco)', async () => {
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
