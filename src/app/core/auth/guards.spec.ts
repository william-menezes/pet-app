/**
 * guards.spec.ts — T032
 *
 * Testa authGuard, adminGuard e anonGuard.
 * FR-011: anonGuard redireciona logado ao destino do papel.
 * FR-012: authGuard redireciona não-logado com returnUrl.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { AuthStore } from './auth.store';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { anonGuard } from './anon.guard';

describe('authGuard', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app', component: class {} as never, canMatch: [authGuard] },
          { path: 'auth/login', component: class {} as never },
          { path: 'auth', component: class {} as never },
        ]),
        AuthStore,
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('deve permitir acesso quando autenticado', () => {
    store.setSession({ user: { id: 'u1' } } as never);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: 'app' } as never, [{ path: 'app' }] as never),
    );
    expect(result).toBe(true);
  });

  it('sem sessão e sem marca => boas-vindas com returnUrl', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: 'app' } as never, [{ path: 'app' }] as never),
    ) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/auth?returnUrl=%2Fapp');
  });

  it('sem sessão e com marca => login com returnUrl e reason=session_expired', () => {
    localStorage.setItem('faro.returning', '1');
    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: 'app' } as never, [{ path: 'app' }, { path: 'conta' }] as never),
    ) as UrlTree;
    expect(result.toString()).toBe('/auth/login?returnUrl=%2Fapp%2Fconta&reason=session_expired');
  });

  it('destino dentro de /auth não vira returnUrl', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: 'auth' } as never, [{ path: 'auth' }, { path: 'termos' }] as never),
    ) as UrlTree;
    expect(result.toString()).toBe('/auth');
  });
});

afterEach(() => localStorage.clear());

describe('adminGuard', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', component: class {} as never },
          { path: 'app', component: class {} as never },
        ]),
        AuthStore,
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('deve permitir acesso para admin autenticado', () => {
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('admin');
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, [] as never));
    expect(result).toBe(true);
  });

  it('deve redirecionar tutor para /app', () => {
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, [] as never)) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toContain('/app');
  });

  it('deve redirecionar não-autenticado para /app (sem papel)', () => {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, [] as never)) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
  });
});

describe('anonGuard', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', component: class {} as never },
          { path: 'app', component: class {} as never },
          { path: 'admin', component: class {} as never },
        ]),
        AuthStore,
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('deve permitir acesso a /auth quando não autenticado', () => {
    const result = TestBed.runInInjectionContext(() => anonGuard({} as never, [] as never));
    expect(result).toBe(true);
  });

  it('deve redirecionar tutor logado para /app (FR-011)', () => {
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('tutor');
    const result = TestBed.runInInjectionContext(() => anonGuard({} as never, [] as never)) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toContain('/app');
  });

  it('deve redirecionar admin logado para /admin (FR-011)', () => {
    store.setSession({ user: { id: 'u1' } } as never);
    store.setRole('admin');
    const result = TestBed.runInInjectionContext(() => anonGuard({} as never, [] as never)) as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toContain('/admin');
  });
});
