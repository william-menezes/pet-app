/**
 * session-persistence.spec.ts — T044
 *
 * Testa o helper de seleção de storage para "manter conectado".
 * FR-007/008/009.
 */
import { getSessionStorage } from './session-persistence';

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
