/**
 * PrivacyService — T078 (spec 004)
 *
 * Direitos do titular (LGPD): exportar os dados e excluir a conta. Único ponto que fala com o Supabase
 * sobre isso (nenhuma tela chama o SDK). Contratos: frontend-services.contract.md §3,
 * account-export.rpc.md ("Frontend") e account-delete.edge.md.
 *
 * Segurança (contrato §6):
 * - O arquivo exportado é gerado no navegador e não fica em signal, store nem campo: o JSON vive só numa
 *   variável local e num `Blob` cujo endereço é revogado logo depois do clique.
 * - A senha vive só no argumento da chamada: nunca em store, storage, URL ou log.
 * - Nenhuma mensagem do Supabase chega à tela (só o código).
 * - `deleteAccount` não usa `AuthService.signOut()` (ele navega para o login com aviso de saída): zera
 *   a sessão local e os stores aqui e deixa a navegação para `/auth?conta=excluida` com a tela.
 */
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { clearReturning } from '../auth/returning-visitor';
import { ReturnUrlService } from '../auth/return-url';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountStore } from './account.store';

export type ExportResult =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'network'; retryAfterSeconds?: number };

export type DeleteError =
  | 'confirmation_required'
  | 'reauth_required'
  | 'invalid_password'
  | 'rate_limited'
  | 'deletion_unavailable'
  | 'deletion_incomplete'
  | 'captcha_failed'
  | 'network';

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: DeleteError; retryAfterSeconds?: number; method?: 'password' | 'google' };

/** Palavra que a pessoa digita e que a função de servidor confere. */
export const DELETE_CONFIRMATION = 'EXCLUIR';

const DELETE_ERRORS: readonly DeleteError[] = [
  'confirmation_required',
  'reauth_required',
  'invalid_password',
  'rate_limited',
  'deletion_unavailable',
  'deletion_incomplete',
  'captcha_failed',
];

/** Tempo entre o clique de download e a revogação do endereço do `Blob`. */
const REVOKE_DELAY_MS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** `faro-meus-dados-AAAA-MM-DD.json`, com a data local de quem baixa. */
export function exportFileName(now: Date = new Date()): string {
  return `faro-meus-dados-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.json`;
}

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly supabase = inject(SupabaseService);
  private readonly authStore = inject(AuthStore);
  private readonly accountStore = inject(AccountStore);
  private readonly returnUrl = inject(ReturnUrlService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  /** `rpc('export_my_data')` e download do JSON. `rate_limited` traz os segundos até poder de novo. */
  async exportData(): Promise<ExportResult> {
    if (!isPlatformBrowser(this.platformId)) return { ok: false, reason: 'network' };

    let data: unknown;
    try {
      const response = await this.supabase.client.rpc('export_my_data');
      if (response.error) {
        if (response.error.message === 'rate_limited') {
          const seconds = Number(response.error.details);
          return {
            ok: false,
            reason: 'rate_limited',
            ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterSeconds: seconds } : {}),
          };
        }
        // `not_authenticated` e qualquer outro erro: a tela não distingue (sessão inválida cai no login).
        return { ok: false, reason: 'network' };
      }
      data = response.data;
    } catch {
      return { ok: false, reason: 'network' };
    }
    if (data === null || data === undefined) return { ok: false, reason: 'network' };

    try {
      this.download(JSON.stringify(data, null, 2));
    } catch {
      return { ok: false, reason: 'network' };
    }
    return { ok: true };
  }

  /** `functions.invoke('account-delete')` com `{ confirm: 'EXCLUIR', password }`. Sucesso encerra a sessão local. */
  async deleteAccount(input: { password?: string; captchaToken?: string }): Promise<DeleteResult> {
    const body: Record<string, string> = { confirm: DELETE_CONFIRMATION };
    if (input.password !== undefined && input.password !== '') body['password'] = input.password;
    if (input.captchaToken) body['captcha_token'] = input.captchaToken;

    let payload: unknown;
    try {
      const { data, error } = await this.supabase.client.functions.invoke('account-delete', { body });
      if (error) return { ok: false, error: 'network' };
      payload = data;
    } catch {
      return { ok: false, error: 'network' };
    }

    if (!isRecord(payload)) return { ok: false, error: 'network' };
    if (payload['ok'] === true) {
      await this.clearLocalSession();
      return { ok: true };
    }
    if (payload['ok'] !== false) return { ok: false, error: 'network' };

    const code = payload['error'];
    const error = DELETE_ERRORS.find((known) => known === code);
    if (error === undefined) return { ok: false, error: 'network' };

    const result: DeleteResult = { ok: false, error };
    const retry = payload['retry_after_seconds'];
    if (typeof retry === 'number' && Number.isFinite(retry)) result.retryAfterSeconds = retry;
    const method = payload['method'];
    if (method === 'password' || method === 'google') result.method = method;
    return result;
  }

  private download(json: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const link = this.document.createElement('a');
      link.href = url;
      link.download = exportFileName();
      link.rel = 'noopener';
      link.style.display = 'none';
      this.document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Sem o endereço, o navegador solta o arquivo da memória assim que o download começar.
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    }
  }

  /** Depois da exclusão o token já não vale: zera sessão local, stores, marca de retorno e destino guardado. */
  private async clearLocalSession(): Promise<void> {
    try {
      await this.supabase.client.auth.signOut({ scope: 'local' });
    } catch {
      // a conta já foi excluída; o que sobrar de sessão local é zerado abaixo
    }
    this.authStore.reset();
    this.accountStore.reset();
    clearReturning(this.platformId);
    this.returnUrl.clear();
  }
}
