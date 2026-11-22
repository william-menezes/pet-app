/**
 * return-url.ts — T022 (spec 004)
 *
 * Guarda o destino pretendido (`returnUrl`) durante os fluxos de `/auth/*` e impede redirecionamento
 * aberto: só caminhos internos do próprio domínio passam por `sanitizeReturnUrl`.
 *
 * Contrato: specs/004-conta-tutor/contracts/frontend-services.contract.md §3.
 * O armazenamento só é tocado aqui, em `core/` (regra de lint da 001); o valor é um caminho
 * interno, nunca token, senha ou código.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'faro.returnUrl';
const MAX_LENGTH = 200;
const ORIGIN = 'https://tagfaro.com.br';

/** Devolve o valor só se for um caminho interno seguro; senão `null`. */
export function sanitizeReturnUrl(raw: unknown): string | null {
  // 1. string de 1 a 200 caracteres
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > MAX_LENGTH) return null;

  // 2. começa com "/" e o segundo caractere não é "/" nem "\"
  if (raw[0] !== '/') return null;
  if (raw[1] === '/' || raw[1] === '\\') return null;

  // 3. sem "://", "\", caracteres de controle, nem "@" antes da primeira "/" seguinte
  if (raw.includes('://') || raw.includes('\\')) return null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  const rest = raw.slice(1);
  const nextSlash = rest.indexOf('/');
  const firstSegment = nextSlash === -1 ? rest : rest.slice(0, nextSlash);
  if (firstSegment.includes('@')) return null;

  // 4. continua dentro do mesmo domínio depois de resolvido
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;

  // 5. nunca volta para dentro do fluxo de autenticação
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return null;

  return raw;
}

@Injectable({ providedIn: 'root' })
export class ReturnUrlService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sanitiza e, se válido, grava em `sessionStorage['faro.returnUrl']`. Inválido não apaga o que já havia. */
  capture(raw: unknown): void {
    const safe = sanitizeReturnUrl(raw);
    if (safe === null || !this.isBrowser) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, safe);
    } catch {
      // armazenamento bloqueado: o fluxo segue sem destino guardado
    }
  }

  /** Lê o destino guardado, revalidando (o storage é do navegador, não é confiável). */
  peek(): string | null {
    if (!this.isBrowser) return null;
    try {
      return sanitizeReturnUrl(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  /** Lê e apaga. */
  consume(): string | null {
    const value = this.peek();
    this.clear();
    return value;
  }

  clear(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // nada a limpar
    }
  }
}
