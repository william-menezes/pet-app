/**
 * session-persistence.ts — T015
 *
 * Seleciona o storage de sessão do Supabase conforme "manter conectado":
 *   - rememberMe=true  → localStorage  (persistente; sobrevive ao fechar/reabrir)
 *   - rememberMe=false → sessionStorage (volátil; limpo ao encerrar a aba/navegador)
 *
 * Contratos: research §R3 / FR-007 / FR-008 / FR-009.
 * O token NUNCA é lido fora de src/app/core/** (invariante T020d).
 *
 * Apenas browser-side: chamar somente quando isPlatformBrowser for verdadeiro.
 */

export type SessionStorageType = 'local' | 'session';

/**
 * Retorna o objeto de storage compatível com a interface do Supabase
 * baseado na preferência "manter conectado".
 */
export function getSessionStorage(rememberMe: boolean): Storage {
  return rememberMe ? localStorage : sessionStorage;
}

/**
 * Wrapper que implementa a interface de storage do Supabase.
 * Permite injetar localStorage ou sessionStorage no cliente Supabase
 * sem acessar o storage diretamente no código de feature.
 */
export class SupabaseStorageAdapter {
  constructor(private storage: Storage) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }
}

// ── Carga da página: onde está a sessão? (DEF-001) ─────────────────────────────────────────────
// O cliente do Supabase nasce a cada carga. Sem isto ele lia só o localStorage e uma sessão volátil
// ("Manter conectado" desligado, gravada no sessionStorage) se perdia no F5.

/** Sessão e usuário do supabase-js. O verificador do PKCE (`-code-verifier`) fica de fora: o login com Google precisa dele. */
const SESSION_KEYS = /^sb-.+-auth-token(-user)?$/;
const SESSION_TOKEN_KEY = /^sb-.+-auth-token$/;

function hasSessionKey(storage: Storage): boolean {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && SESSION_TOKEN_KEY.test(key)) return true;
  }
  return false;
}

function clearSessionKeys(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && SESSION_KEYS.test(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

/** Apaga a credencial do Supabase dos DOIS storages (nada fica órfão). Nunca lança. */
export function clearPersistedSessions(): void {
  for (const pick of [() => localStorage, () => sessionStorage]) {
    try {
      clearSessionKeys(pick());
    } catch {
      // storage indisponível: não há o que limpar
    }
  }
}

/**
 * Storage onde há uma sessão do Supabase (`sb-…-auth-token`), ou null (nenhuma, ou storage indisponível).
 * Se houver nos dois, vale o localStorage ("Manter conectado") e a credencial do sessionStorage é apagada.
 * Só no navegador.
 */
export function findPersistedStorage(): Storage | null {
  try {
    if (hasSessionKey(localStorage)) {
      try {
        clearSessionKeys(sessionStorage);
      } catch {
        // sessionStorage indisponível: segue com o local
      }
      return localStorage;
    }
    if (hasSessionKey(sessionStorage)) return sessionStorage;
  } catch {
    // acesso ao storage bloqueado
  }
  return null;
}
