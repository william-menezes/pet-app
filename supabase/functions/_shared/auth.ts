/**
 * Autenticacao das Edge Functions de tag (spec 003, T023).
 *
 *  - `requireSsrKey`: confere o cabecalho `x-faro-ssr-key` (servidor SSR do app -> resolve-tag e register-scan).
 *    A comparacao e em tempo constante: compara-se o SHA-256 da chave recebida com o SHA-256 de cada chave
 *    aceita, sem sair no primeiro acerto. Ja aceita uma LISTA de chaves (FARO_SSR_KEY e, se existir,
 *    FARO_SSR_KEY_PREVIOUS: rotacao sem queda; contracts/security-hardening.contract.md, secao 2).
 *    Chave com menos de 32 caracteres, ou nenhuma configurada: a funcao nao atende (500, nada de fallback).
 *  - `requireAdmin`: JWT do chamador + papel de admin verificado no banco (`is_admin()` com o proprio JWT).
 *    O guard de rota do app e so conveniencia; a verificacao real e esta.
 *
 * Modulo sem import de rede: o que fala com o Supabase entra por `AdminDeps` (ver `supabase.ts`), para os testes
 * rodarem sem permissoes. Nunca escreve chave, token ou JWT em log nem em mensagem de erro.
 */
import { MisconfiguredError } from "./env.ts";
import { forbidden, internalError, misconfigured, unauthorized } from "./responses.ts";

export const SSR_KEY_HEADER = "x-faro-ssr-key";
export const MIN_SSR_KEY_LENGTH = 32;

type Reader = (name: string) => string | undefined;

const denoReader: Reader = (name) => Deno.env.get(name);
const enc = new TextEncoder();

/**
 * Chaves aceitas, da mais nova para a mais antiga: `FARO_SSR_KEY` (obrigatoria) e `FARO_SSR_KEY_PREVIOUS` (opcional).
 * Lanca MisconfiguredError (so com o NOME da variavel) se faltar ou tiver menos de 32 caracteres.
 * `read` e injetavel: o CI roda `deno test` sem permissao de env.
 */
export function ssrKeysFromEnv(read: Reader = denoReader): string[] {
  const current = read("FARO_SSR_KEY");
  if (current === undefined || current.length < MIN_SSR_KEY_LENGTH) throw new MisconfiguredError("FARO_SSR_KEY");
  const keys = [current];
  const previous = read("FARO_SSR_KEY_PREVIOUS");
  if (previous !== undefined && previous.trim() !== "") {
    if (previous.length < MIN_SSR_KEY_LENGTH) throw new MisconfiguredError("FARO_SSR_KEY_PREVIOUS");
    keys.push(previous);
  }
  return keys;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

/** Compara dois resumos de mesmo tamanho sem sair no primeiro byte diferente. */
function sameDigest(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * true se `provided` e igual a alguma das `keys`. Compara os SHA-256 (tamanho fixo, entao o tempo nao depende de
 * quantos caracteres da chave coincidem) e percorre TODAS as chaves, sem curto-circuito.
 */
export async function ssrKeyMatches(provided: string | null, keys: readonly string[]): Promise<boolean> {
  const providedDigest = await sha256(provided ?? "");
  let matched = false;
  for (const key of keys) {
    const ok = sameDigest(providedDigest, await sha256(key));
    matched = matched || ok;
  }
  return matched && provided !== null && provided !== "";
}

/**
 * null se a chamada traz uma chave aceita. Senao a Response a devolver:
 * 500 se a configuracao for fraca ou ausente (verificada ANTES de olhar o cabecalho); 401 de corpo vazio caso contrario.
 * `getKeys` devolve as chaves (use `() => ssrKeysFromEnv()`); se lancar MisconfiguredError, a resposta e 500.
 */
export async function requireSsrKey(req: Request, getKeys: () => readonly string[]): Promise<Response | null> {
  let keys: readonly string[];
  try {
    keys = getKeys();
  } catch (e) {
    if (e instanceof MisconfiguredError) return misconfigured();
    return internalError();
  }
  if (keys.length === 0 || keys.some((k) => k.length < MIN_SSR_KEY_LENGTH)) return misconfigured();
  const ok = await ssrKeyMatches(req.headers.get(SSR_KEY_HEADER), keys);
  return ok ? null : unauthorized();
}

/** Token do cabecalho `Authorization: Bearer <jwt>`, ou null. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/** O que `requireAdmin` precisa do mundo (ver `supabase.ts` para a implementacao real). */
export interface AdminDeps {
  /** Valida o JWT (auth.getUser) e devolve o usuario, ou null se o token nao vale (anonimo incluso). */
  getCaller(req: Request): Promise<{ id: string } | null>;
  /** `is_admin()` no banco, chamada com o JWT do proprio chamador. */
  isAdmin(token: string): Promise<boolean>;
}

export type AdminResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; response: Response };

/**
 * JWT valido e papel de admin. Sem JWT (ou JWT que nao vale): 401 vazio. JWT valido de quem nao e admin: 403.
 * Falha ao consultar o banco: 500 (falha fechada: nunca "deixa passar").
 */
export async function requireAdmin(req: Request, deps: AdminDeps): Promise<AdminResult> {
  const token = bearerToken(req);
  if (token === null) return { ok: false, response: unauthorized() };
  let caller: { id: string } | null;
  try {
    caller = await deps.getCaller(req);
  } catch {
    return { ok: false, response: internalError() };
  }
  if (caller === null) return { ok: false, response: unauthorized() };
  let admin: boolean;
  try {
    admin = await deps.isAdmin(token);
  } catch {
    return { ok: false, response: internalError() };
  }
  if (admin !== true) return { ok: false, response: forbidden() };
  return { ok: true, userId: caller.id, token };
}
