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
