/**
 * PasswordService — T068 (spec 004)
 *
 * Recuperação de senha pelo link do e-mail. Único ponto que fala com o Supabase sobre a recuperação
 * (nenhuma tela chama o SDK). Contratos: password-recovery.edge.md e frontend-services.contract.md §3.
 *
 * Segurança:
 * - `requestRecovery` nunca revela nada: sucesso e qualquer falha resolvem do mesmo jeito (a função de
 *   servidor também responde sempre igual).
 * - `resetPassword` só chama o `verifyOtp` quando a tela envia o formulário (scanners de e-mail abrem
 *   links; a tela nunca chama ao carregar) e consome o link uma única vez: depois de `weak_password`, a
 *   nova tentativa reaproveita a sessão de recuperação em vez de repetir o `verifyOtp`.
 * - Senha e `token_hash` vivem só nos argumentos e neste campo privado: nunca em store, storage, URL
 *   ou log. Nenhuma mensagem do Supabase chega à tela (só o `reason`).
 */
import { Injectable, inject } from '@angular/core';
import { AccountStore } from '../account/account.store';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthStore } from './auth.store';

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_link' | 'weak_password' | 'network' };

export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'no_password' | 'invalid_current' | 'weak_password' | 'rate_limited' | 'network';
    };

interface AuthErrorLike {
  status?: number;
  code?: string;
  name?: string;
}

function isNetworkError(error: AuthErrorLike): boolean {
  return error.name === 'AuthRetryableFetchError' || error.status === 0;
}

@Injectable({ providedIn: 'root' })
export class PasswordService {
  private readonly supabase = inject(SupabaseService);
  private readonly authStore = inject(AuthStore);
  private readonly accountStore = inject(AccountStore);

  /** `token_hash` que já passou no `verifyOtp` (a sessão de recuperação está ativa). Só na memória. */
  private verifiedToken: string | null = null;

  /** Pede o e-mail de recuperação. Resolve igual em sucesso e em falha (inclusive de rede). */
  async requestRecovery(email: string, captchaToken?: string): Promise<void> {
    try {
      await this.supabase.client.functions.invoke('password-recovery', {
        body: captchaToken ? { email, captcha_token: captchaToken } : { email },
      });
    } catch {
      // resposta uniforme por design (anti-enumeração): a tela mostra sempre a mesma confirmação
    }
  }

  /** Troca a senha pelo link: `verifyOtp` → `updateUser` → `signOut` global. */
  async resetPassword(tokenHash: string, newPassword: string): Promise<ResetPasswordResult> {
    const auth = this.supabase.client.auth;

    if (this.verifiedToken !== tokenHash) {
      try {
        const { error } = await auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (error) {
          return isNetworkError(error as AuthErrorLike)
            ? { ok: false, reason: 'network' }
            : { ok: false, reason: 'invalid_link' };
        }
        this.verifiedToken = tokenHash;
      } catch {
        return { ok: false, reason: 'network' };
      }
    }

    try {
      const { error } = await auth.updateUser({ password: newPassword });
      if (error) {
        const failure = error as AuthErrorLike;
        if (failure.code === 'weak_password') return { ok: false, reason: 'weak_password' };
        // 401/403: a sessão de recuperação não vale mais; é o mesmo que um link vencido.
        if (failure.status === 401 || failure.status === 403) {
          this.verifiedToken = null;
          return { ok: false, reason: 'invalid_link' };
        }
        return { ok: false, reason: 'network' };
      }
    } catch {
      return { ok: false, reason: 'network' };
    }

    this.verifiedToken = null;
    try {
      await auth.signOut({ scope: 'global' });
    } catch {
      // a senha já mudou; o que sobrar de sessão local é zerado abaixo
    }
    // O `AuthStore` precisa ficar sem sessão: `/auth/login` tem `anonGuard`.
    this.authStore.reset();
    this.accountStore.reset();
    return { ok: true };
  }

  /** Entra na T087 (Phase 8). */
  changePassword(current: string, next: string): Promise<ChangePasswordResult> {
    void current;
    void next;
    return Promise.reject(new Error('Não implementado: troca de senha em Conta entra na T087.'));
  }
}
