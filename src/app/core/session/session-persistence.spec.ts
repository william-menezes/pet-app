/**
 * session-persistence.spec.ts — T044
 *
 * Testa o helper de seleção de storage para "manter conectado".
 * FR-007/008/009.
 */
import {
  clearPersistedSessions,
  findPersistedStorage,
  getSessionStorage,
} from './session-persistence';

describe('getSessionStorage', () => {
  it('deve retornar localStorage quando rememberMe=true (sessão persistente, FR-008)', () => {
    const storage = getSessionStorage(true);
    expect(storage).toBe(localStorage);
  });

  it('deve retornar sessionStorage quando rememberMe=false (sessão volátil, FR-009)', () => {
    const storage = getSessionStorage(false);
    expect(storage).toBe(sessionStorage);
  });

  it('localStorage e sessionStorage devem ser objetos distintos', () => {
    const persistent = getSessionStorage(true);
    const volatile = getSessionStorage(false);
    expect(persistent).not.toBe(volatile);
  });
});

describe('findPersistedStorage (DEF-001)', () => {
  const KEY = 'sb-abcdef-auth-token';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sessão só no sessionStorage: devolve o sessionStorage', () => {
    sessionStorage.setItem(KEY, '{}');
    expect(findPersistedStorage()).toBe(sessionStorage);
  });

  it('sessão só no localStorage: devolve o localStorage', () => {
    localStorage.setItem(KEY, '{}');
    expect(findPersistedStorage()).toBe(localStorage);
  });

  it('nos dois: vale o localStorage e a credencial do sessionStorage é apagada', () => {
    localStorage.setItem(KEY, '{}');
    sessionStorage.setItem(KEY, '{}');
    sessionStorage.setItem('outra-coisa', '1');
    expect(findPersistedStorage()).toBe(localStorage);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem('outra-coisa')).toBe('1');
  });

  it('nenhum: devolve null', () => {
    localStorage.setItem('outra-coisa', '1');
    expect(findPersistedStorage()).toBeNull();
  });

  it('storage indisponível (lança): devolve null, sem lançar', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(findPersistedStorage()).toBeNull();
    expect(() => clearPersistedSessions()).not.toThrow();
  });
});

describe('clearPersistedSessions (DEF-001)', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('apaga o token dos dois storages e preserva o resto, inclusive o verificador do PKCE', () => {
    localStorage.setItem('sb-abcdef-auth-token', '{}');
    sessionStorage.setItem('sb-abcdef-auth-token', '{}');
    sessionStorage.setItem('sb-abcdef-auth-token-user', '{}');
    localStorage.setItem('sb-abcdef-auth-token-code-verifier', 'v');
    localStorage.setItem('outra-coisa', '1');
    clearPersistedSessions();
    expect(localStorage.getItem('sb-abcdef-auth-token')).toBeNull();
    expect(sessionStorage.getItem('sb-abcdef-auth-token')).toBeNull();
    expect(sessionStorage.getItem('sb-abcdef-auth-token-user')).toBeNull();
    expect(localStorage.getItem('sb-abcdef-auth-token-code-verifier')).toBe('v');
    expect(localStorage.getItem('outra-coisa')).toBe('1');
  });
});
