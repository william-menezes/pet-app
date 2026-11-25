/**
 * owner-probe.service.ts — T048 (spec 003; contrato de integração §5.2)
 *
 * Sonda da "visão do dono": devolve o token de acesso do tutor logado, se houver, para o `POST /api/scan`
 * mandá-lo em `Authorization: Bearer`. Assim o servidor reconhece o dono e não grava scan nem manda
 * e-mail de aviso quando o tutor abre a própria tag.
 *
 * Só roda no NAVEGADOR, depois da hidratação. A página pública NÃO importa `core/auth`:
 *  1. procura uma chave de sessão do Supabase (`sb-…-auth-token`) em `localStorage` e em
 *     `sessionStorage` (a sessão vai para um ou outro conforme "manter conectado");
 *  2. SEM chave nas duas: não importa nada e devolve `null` (a chamada segue sem `Authorization`);
 *  3. com chave: importa `core/supabase/supabase.service` por `import()` dinâmico e pede a sessão ao
 *     cliente (que renova o token se preciso);
 *  4. se o cliente não achar a sessão (a volátil, de `sessionStorage`, não é lida por ele; defeito
 *     DEF-001 da 004), usa o token gravado na própria chave, desde que ainda não tenha vencido.
 * Qualquer falha devolve `null`: o visitante segue como anônimo.
 */
import { Injectable, Injector, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { hasPersistedSession } from '../session/session-bootstrap';

const SESSION_KEY = /^sb-.+-auth-token$/;

interface ClientLoader {
  SupabaseService: new (...args: never[]) => {
    client: { auth: { getSession(): Promise<{ data: { session: { access_token: string } | null } }> } };
  };
}

/** Token gravado numa das duas storages, se ainda válido (com 30 s de folga). */
export function storedAccessToken(now: number = Date.now()): string | null {
  for (const storage of [localStorage, sessionStorage]) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null || !SESSION_KEY.test(key)) continue;
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? 'null');
        const token = (value as { access_token?: unknown } | null)?.access_token;
        if (typeof token !== 'string') continue;
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
        if (typeof payload.exp === 'number' && payload.exp * 1000 > now + 30_000) return token;
      } catch {
        // chave com outro formato: ignora
      }
    }
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class OwnerProbe {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);

  /** `load` existe para os testes. */
  async accessToken(
    load: () => Promise<ClientLoader> = () => import('../supabase/supabase.service'),
  ): Promise<string | null> {
    if (!this.isBrowser || !hasPersistedSession()) return null;
    try {
      const { SupabaseService } = await load();
      const { data } = await this.injector.get(SupabaseService).client.auth.getSession();
      if (data.session?.access_token) return data.session.access_token;
    } catch {
      // cai no token gravado
    }
    try {
      return storedAccessToken();
    } catch {
      return null;
    }
  }
}
