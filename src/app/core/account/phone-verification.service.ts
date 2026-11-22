/**
 * PhoneVerificationService — T054 (spec 004)
 *
 * Confirmação do celular por SMS. Fala com a RPC `phone_verification_status` e com as Edge Functions
 * `phone-verify-start` e `phone-verify-confirm`. O serviço NÃO decide nada sobre o código: só repassa
 * a resposta do servidor. Qualquer resposta que não seja HTTP 200 com corpo JSON vira `network`.
 *
 * Contratos: contracts/frontend-services.contract.md §3, phone-verify-start.edge.md,
 * phone-verify-confirm.edge.md, phone-verification.rpc.md.
 *
 * Segurança: senha, código e telefone passam só pelos argumentos e pelo corpo da requisição; nada vai
 * para log, store, storage ou URL, e nenhuma mensagem do Supabase é exposta.
 */
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountService } from './account.service';

export interface PhoneStatus {
  phoneConfirmed: boolean;
  phone: string | null;
  pendingPhone: string | null;
  active: { expiresAt: string; attemptsLeft: number } | null;
  resendAvailableAt: string | null;
}

export type StartError =
  | 'email_not_confirmed'
  | 'terms_required'
  | 'invalid_phone'
  | 'same_number'
  | 'reauth_required'
  | 'invalid_password'
  | 'cooldown'
  | 'rate_limited'
  | 'sms_unavailable'
  | 'sms_send_failed'
  | 'network';

export type StartResult =
  | { ok: true; phone: string; expiresAt: string; resendAvailableAt: string; attemptsLeft: number }
  | { ok: false; error: StartError; retryAfterSeconds?: number; method?: 'password' | 'google' };

export type ConfirmError =
  | 'invalid_format'
  | 'invalid_code'
  | 'locked'
  | 'expired'
  | 'no_active'
  | 'network';

export type ConfirmResult =
  | { ok: true; phone: string }
  | { ok: false; error: ConfirmError; attemptsLeft?: number };

const START_ERRORS: readonly StartError[] = [
  'email_not_confirmed',
  'terms_required',
  'invalid_phone',
  'same_number',
  'reauth_required',
  'invalid_password',
  'cooldown',
  'rate_limited',
  'sms_unavailable',
  'sms_send_failed',
];

const CONFIRM_ERRORS: readonly ConfirmError[] = [
  'invalid_format',
  'invalid_code',
  'locked',
  'expired',
  'no_active',
];

interface RawStatus {
  phone_confirmed?: unknown;
  phone?: unknown;
  pending_phone?: unknown;
  active?: { expires_at?: unknown; attempts_left?: unknown } | null;
  resend_available_at?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

@Injectable({ providedIn: 'root' })
export class PhoneVerificationService {
  private readonly supabase = inject(SupabaseService);
  private readonly accountService = inject(AccountService);

  /** `rpc('phone_verification_status')`. Falha ⇒ `null`. */
  async status(): Promise<PhoneStatus | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('phone_verification_status');
      if (error || !isRecord(data)) return null;
      const raw = data as RawStatus;
      const active =
        isRecord(raw.active) &&
        typeof raw.active['expires_at'] === 'string' &&
        typeof raw.active['attempts_left'] === 'number'
          ? { expiresAt: raw.active['expires_at'], attemptsLeft: raw.active['attempts_left'] }
          : null;
      return {
        phoneConfirmed: raw.phone_confirmed === true,
        phone: optionalString(raw.phone),
        pendingPhone: optionalString(raw.pending_phone),
        active,
        resendAvailableAt: optionalString(raw.resend_available_at),
      };
    } catch {
      return null;
    }
  }

  /** `functions.invoke('phone-verify-start')`. O corpo só leva o que a tela informou. */
  async start(input: { phone?: string; password?: string } = {}): Promise<StartResult> {
    const body: Record<string, string> = {};
    if (input.phone !== undefined) body['phone'] = input.phone;
    if (input.password !== undefined) body['password'] = input.password;

    const data = await this.invoke('phone-verify-start', body);
    if (data === null) return { ok: false, error: 'network' };

    if (data['ok'] === true) {
      const { phone, expires_at, resend_available_at, attempts_left } = data;
      if (
        typeof phone !== 'string' ||
        typeof expires_at !== 'string' ||
        typeof resend_available_at !== 'string' ||
        typeof attempts_left !== 'number'
      ) {
        return { ok: false, error: 'network' };
      }
      return {
        ok: true,
        phone,
        expiresAt: expires_at,
        resendAvailableAt: resend_available_at,
        attemptsLeft: attempts_left,
      };
    }

    const error = data['error'];
    if (typeof error !== 'string' || !START_ERRORS.includes(error as StartError)) {
      return { ok: false, error: 'network' };
    }
    const result: Extract<StartResult, { ok: false }> = { ok: false, error: error as StartError };
    const retry = optionalNumber(data['retry_after_seconds']);
    if (retry !== undefined) result.retryAfterSeconds = retry;
    const method = data['method'];
    if (method === 'password' || method === 'google') result.method = method;
    return result;
  }

  /** `functions.invoke('phone-verify-confirm')`. Em sucesso recarrega a conta (`my_account`). */
  async confirm(code: string): Promise<ConfirmResult> {
    const data = await this.invoke('phone-verify-confirm', { code });
    if (data === null) return { ok: false, error: 'network' };

    if (data['ok'] === true) {
      if (typeof data['phone'] !== 'string') return { ok: false, error: 'network' };
      await this.accountService.load(true);
      return { ok: true, phone: data['phone'] };
    }

    const error = data['error'];
    if (typeof error !== 'string' || !CONFIRM_ERRORS.includes(error as ConfirmError)) {
      return { ok: false, error: 'network' };
    }
    const result: Extract<ConfirmResult, { ok: false }> = { ok: false, error: error as ConfirmError };
    const left = optionalNumber(data['attempts_left']);
    if (left !== undefined) result.attemptsLeft = left;
    return result;
  }

  /**
   * As funções respondem sempre HTTP 200 com `{ ok … }`. Fora disso o SDK devolve `error` (e `data`
   * nulo) e aqui vira `null` ⇒ `network`.
   */
  private async invoke(
    name: 'phone-verify-start' | 'phone-verify-confirm',
    body: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke(name, { body });
      if (error || !isRecord(data)) return null;
      return data;
    } catch {
      return null;
    }
  }
}
