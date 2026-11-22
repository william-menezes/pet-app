/**
 * RegistrationService — T031 (spec 004)
 *
 * Cadastro por e-mail e senha e confirmação do e-mail. Único ponto que fala com o Supabase Auth
 * sobre cadastro (nenhuma tela chama o SDK). Contrato: contracts/frontend-services.contract.md §3.
 *
 * Segurança (FR-006, anti-enumeração):
 * - "E-mail já cadastrado" (422 `user_already_exists`) e o 429 de reenvio devolvem o mesmo `{ ok: true }`
 *   de um e-mail novo, e toda resposta espera o tempo mínimo de 1.200 ms.
 * - A senha vive só no argumento da chamada: nunca em store, storage, URL ou log.
 * - Nenhuma mensagem do Supabase chega à tela (só o `reason`).
 */
import { Injectable, inject } from '@angular/core';
import { normalizeBrPhone } from '../account/phone';
import { TERMS_VERSION } from '../account/terms';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { ReturnUrlService } from './return-url';

export interface SignUpInput {
  nome: string;
  email: string;
  celular: string;
  senha: string;
  aceite: boolean;
  /** Desafio anti-robô (Phase 10, `TODO(CAPTCHA)`): opcional, ainda sem uso. */
  captchaToken?: string;
}

export type SignUpResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'weak_password' | 'rate_limited' | 'network' };

export type ConfirmEmailResult = { ok: true } | { ok: false; reason: 'invalid_link' | 'network' };

/** Tempo mínimo de resposta do cadastro, igual para todo resultado (contrato §3, passo 4). */
export const SIGNUP_MIN_RESPONSE_MS = 1200;

const NAME_MIN = 2;
const NAME_MAX = 80;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthErrorLike {
  status?: number;
  code?: string;
  name?: string;
}

function isNetworkError(error: AuthErrorLike): boolean {
  return error.name === 'AuthRetryableFetchError' || error.status === 0;
}

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly returnUrl = inject(ReturnUrlService);

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const nome = input.nome.trim();
    const email = input.email.trim();
    const phone = normalizeBrPhone(input.celular);

    if (
      nome.length < NAME_MIN ||
      nome.length > NAME_MAX ||
      !EMAIL_FORMAT.test(email) ||
      phone === null ||
      input.senha.length < PASSWORD_MIN ||
      input.senha.length > PASSWORD_MAX ||
      input.aceite !== true
    ) {
      return { ok: false, reason: 'invalid' };
    }

    const inicio = performance.now();
    const returnTo = this.returnUrl.peek();
    const data: Record<string, string> = {
      name: nome,
      phone,
      terms_version: TERMS_VERSION,
    };
    if (returnTo !== null) {
      data['return_to'] = returnTo;
      data['return_to_at'] = new Date().toISOString();
    }

    let result: SignUpResult = { ok: true };
    try {
      const { error } = await this.supabase.client.auth.signUp({
        email,
        password: input.senha,
        options: {
          data,
          ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
        },
      });
      if (error) result = this.classify(error as AuthErrorLike);
    } catch {
      result = { ok: false, reason: 'network' };
    }

    const restante = SIGNUP_MIN_RESPONSE_MS - (performance.now() - inicio);
    if (restante > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, restante));
    }
    return result;
  }

  /** Reenvio com resposta uniforme: nunca revela se o e-mail tem cadastro pendente. */
  async resendConfirmation(email: string): Promise<void> {
    await this.authService.resendConfirmation(email);
  }

  /** Troca o `token_hash` do link por sessão. Vencido, usado ou adulterado: a mesma resposta. */
  async confirmEmail(tokenHash: string): Promise<ConfirmEmailResult> {
    try {
      const { error } = await this.supabase.client.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
      });
      if (!error) return { ok: true };
      return isNetworkError(error as AuthErrorLike)
        ? { ok: false, reason: 'network' }
        : { ok: false, reason: 'invalid_link' };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  private classify(error: AuthErrorLike): SignUpResult {
    if (isNetworkError(error)) return { ok: false, reason: 'network' };
    if (error.code === 'weak_password') return { ok: false, reason: 'weak_password' };
    // 422 `user_already_exists` (confirmado) e o 429 de reenvio (ainda não confirmado) são o mesmo
    // sucesso de um e-mail novo. Outro 429 é limite de pedidos de verdade.
    if (error.code === 'user_already_exists') return { ok: true };
    if (error.status === 429) {
      return error.code === 'over_email_send_rate_limit'
        ? { ok: true }
        : { ok: false, reason: 'rate_limited' };
    }
    return { ok: true };
  }
}
