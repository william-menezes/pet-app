/**
 * AuthService — T014, T025, T035, T040
 *
 * Encapsula TODO acesso ao Supabase Auth. Nenhuma view chama o SDK diretamente.
 * O token NUNCA é lido por código de feature — só o SDK em core/ o manipula (T020d).
 *
 * Contratos: contracts/auth-service.contract.md
 * Segurança:
 *   - Mensagens de falha SEMPRE genéricas (FR-014/019, anti-enumeração).
 *   - Timing uniforme: sem early-return divergente entre inexistente/senha errada (SC-004).
 *   - Rate-limit via Edge Function login-guard ANTES do signIn (FR-018).
 *   - Papel lido de perfis.papel via RPC (FR-005/006); autorização real = RLS is_admin().
 *   - Segredos (service_role, Google secret) NUNCA aqui — só em Edge Functions.
 */
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore, Role } from './auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import { getSessionStorage } from './session-persistence';
import { environment } from '../../../environments/environment';

export interface AuthResult {
  ok: boolean;
  role?: Role;
  reason?: 'invalid' | 'unconfirmed' | 'rate_limited' | 'provider_unavailable' | 'network';
}

/** Mensagens PT-BR canônicas (anti-enumeração: nunca ramifica por código do GoTrue). */
const ERROR_MESSAGES: Record<NonNullable<AuthResult['reason']>, string> = {
  invalid: 'E-mail ou senha inválidos. Verifique e tente de novo.',
  unconfirmed: 'Confirme seu e-mail para entrar. Não recebeu o e-mail de confirmação?',
  rate_limited: 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar de novo.',
  provider_unavailable: 'Login com Google está indisponível agora. Entre com e-mail e senha.',
  network: 'Não conseguimos conectar. Verifique sua conexão e tente de novo.',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(AuthStore);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Controla se a sessão deve ser persistente (localStorage) ou volátil (sessionStorage). */
  private rememberMe = false;

  /** Sinal público para o estado de "e-mail não confirmado" — ativa o banner de reenvio. */
  readonly isUnconfirmed = signal(false);

  // ────────────────────────────────────────────────────────────────
  // Bootstrap
  // ────────────────────────────────────────────────────────────────

  /**
   * Restaura a sessão existente e assina onAuthStateChange.
   * Chamado no bootstrap CSR (app.config.ts APP_INITIALIZER ou similar).
   * Suporta FR-011: logado acessando /auth → redireciona ao destino do papel.
   */
  async restoreSession(): Promise<void> {
    if (!this.isBrowser) return;

    const { data } = await this.supabase.client.auth.getSession();
    if (data.session) {
      this.store.setSession(data.session);
      await this._resolveRole();
    }

    this.supabase.client.auth.onAuthStateChange(async (event, session) => {
      this.store.setSession(session);
      if (session) {
        await this._resolveRole();
      } else {
        this.store.setRole(null);
      }
    });
  }

  // ────────────────────────────────────────────────────────────────
  // "Manter conectado" (FR-007/008/009)
  // ────────────────────────────────────────────────────────────────

  /**
   * Define se a sessão será persistente (true = localStorage) ou
   * volátil (false = sessionStorage). Deve ser chamado ANTES do signIn.
   */
  setRememberMe(remember: boolean): void {
    this.rememberMe = remember;
    if (this.isBrowser) {
      // Configura o storage no cliente Supabase para a próxima sessão.
      // O supabase-js aceita storage customizado; aqui aplicamos antes do signIn.
      (this.supabase.client.auth as unknown as { storage: Storage }).storage =
        getSessionStorage(remember);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Login e-mail/senha (US1)
  // ────────────────────────────────────────────────────────────────

  /**
   * Autentica com e-mail e senha.
   *
   * Fluxo (contratos/login-rate-limit.edge.md):
   * 1. Chama login-guard (Edge) com phase='pre_attempt' — verifica rate-limit.
   * 2. Se block/backoff → retorna rate_limited SEM chamar o GoTrue (timing uniforme).
   * 3. Chama signInWithPassword.
   * 4. Trata e-mail não confirmado (FR-024) sem revelar existência.
   * 5. Mensagem de falha SEMPRE genérica (FR-014/019).
   * 6. Sucesso → resolve papel → emite estado.
   * 7. Registra o resultado (sucesso/falha) via login-guard post_result —
   *    ÚNICO caminho que alimenta o rate-limit (FR-018) e a auditoria (FR-020).
   */
  async signInPassword(email: string, password: string): Promise<AuthResult> {
    this.store.setStatus('loading');
    this.store.clearError();
    this.isUnconfirmed.set(false);

    try {
      // ── Passo 1: rate-limit pré-tentativa (Edge Function) ──
      const rateLimitResult = await this._checkRateLimit(email);
      if (rateLimitResult !== 'allow') {
        const result: AuthResult = { ok: false, reason: 'rate_limited' };
        this.store.setError(ERROR_MESSAGES.rate_limited);
        return result;
      }

      // ── Passo 2: autenticar com GoTrue ──
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email,
        password,
      });

      // ── Passo 3: processar resultado (timing uniforme) ──
      if (error) {
        const reason = this._classifyError(error.message);

        if (reason === 'unconfirmed') {
          // E-mail não confirmado: banner específico SEM revelar existência.
          // Não conta como falha de rate-limit (as credenciais podem estar corretas).
          this.isUnconfirmed.set(true);
          this.store.setError(ERROR_MESSAGES.unconfirmed);
          return { ok: false, reason: 'unconfirmed' };
        }

        // Credencial inválida OU conta inexistente → MESMA mensagem (FR-014/019).
        // Registra a falha (rate-limit FR-018 + auditoria login_falha FR-020) pelo
        // MESMO caminho nos dois casos → timing indistinguível (SC-004).
        if (reason === 'invalid') {
          await this._recordResult(email, false, 'password');
        }
        this.store.setError(ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.invalid);
        return { ok: false, reason };
      }

      if (!data.session) {
        await this._recordResult(email, false, 'password');
        this.store.setError(ERROR_MESSAGES.invalid);
        return { ok: false, reason: 'invalid' };
      }

      // ── Passo 4: sucesso ──
      this.store.setSession(data.session);
      // Registra o sucesso (auditoria login_sucesso FR-020).
      await this._recordResult(email, true, 'password', data.user?.id ?? data.session.user?.id);
      const role = await this._resolveRole();
      this.store.setStatus('idle');
      return { ok: true, role: role ?? undefined };
    } catch {
      const result: AuthResult = { ok: false, reason: 'network' };
      this.store.setError(ERROR_MESSAGES.network);
      return result;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Login Google / OAuth (US2)
  // ────────────────────────────────────────────────────────────────

  /**
   * Inicia o fluxo OAuth com Google.
   * Redireciona para a página de consentimento do Google.
   * O callback é tratado em /auth/callback (CSR, oauth-callback.ts).
   * Client id/secret ficam NO SERVIDOR (Supabase config.toml) — nunca aqui.
   */
  async signInWithGoogle(): Promise<void> {
    this.store.setStatus('loading');
    this.store.clearError();

    try {
      const redirectTo = this.isBrowser
        ? `${window.location.origin}/auth/callback`
        : `${environment.supabaseUrl}/auth/callback`;

      const { error } = await this.supabase.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (error) {
        this.store.setError(ERROR_MESSAGES.provider_unavailable);
        this.store.setStatus('error');
      }
    } catch {
      this.store.setError(ERROR_MESSAGES.network);
      this.store.setStatus('error');
    }
  }

  /**
   * Processa o retorno do OAuth na rota /auth/callback.
   * Trata sucesso (cria sessão → roteia por papel) e cancelamento/erro
   * (mensagem neutra + volta ao login). FR-015, US2 cenários 2/3.
   */
  async handleOAuthCallback(): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.client.auth.getSession();

      if (error || !data.session) {
        // Cancelamento ou erro do provider
        const reason: AuthResult['reason'] =
          error?.message?.toLowerCase().includes('network') ? 'network' : 'provider_unavailable';
        this.store.setError(ERROR_MESSAGES[reason!]);
        return { ok: false, reason };
      }

      this.store.setSession(data.session);
      // Auditoria de login social bem-sucedido (FR-020). Google não entra no
      // rate-limit de senha, mas o sucesso deve ser auditado.
      await this._recordResult(data.session.user?.email ?? '', true, 'google', data.session.user?.id);
      const role = await this._resolveRole();
      this.store.setStatus('idle');
      return { ok: true, role: role ?? undefined };
    } catch {
      this.store.setError(ERROR_MESSAGES.network);
      return { ok: false, reason: 'network' };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Reenvio de confirmação (FR-024)
  // ────────────────────────────────────────────────────────────────

  /**
   * Reenvia o e-mail de confirmação.
   * Resposta uniforme: NÃO confirma nem nega existência da conta (anti-enumeração).
   */
  async resendConfirmation(email: string): Promise<void> {
    try {
      await this.supabase.client.auth.resend({ type: 'signup', email });
    } catch {
      // Ignora erro silenciosamente — resposta uniforme por design (anti-enumeração)
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Logout (US3, FR-010)
  // ────────────────────────────────────────────────────────────────

  /**
   * Encerra a sessão, limpa o storage e navega ao login.
   * GAP CONHECIDO (FR-020): a auditoria de logout ainda NÃO está implementada.
   * `log_auth_event` é service_role-only e a Edge login-guard não tem fase 'logout';
   * auditar o logout exigiria uma fase 'logout' na Edge (mudança de backend).
   * Sinalizado para o gate de QA/segurança.
   */
  async signOut(): Promise<void> {
    try {
      await this.supabase.client.auth.signOut();
    } finally {
      this.store.reset();
      this.isUnconfirmed.set(false);
      await this.router.navigate(['/auth/login'], {
        queryParams: { loggedOut: '1' },
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Mensagem PT-BR a partir de um reason
  // ────────────────────────────────────────────────────────────────

  getErrorMessage(reason: AuthResult['reason']): string {
    return reason ? (ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.invalid) : ERROR_MESSAGES.invalid;
  }

  // ────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────

  /**
   * Chama a Edge Function login-guard com phase='pre_attempt'.
   * Retorna a decisão: 'allow' | 'backoff' | 'block'.
   * Em caso de erro (Edge indisponível), permite a tentativa (fail-open
   * controlado pelo GoTrue nativo) mas não propaga.
   */
  private async _checkRateLimit(email: string): Promise<'allow' | 'backoff' | 'block'> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('login-guard', {
        body: { email, phase: 'pre_attempt' },
      });
      if (error) return 'allow'; // fail-open: GoTrue nativo ainda protege
      return (data as { decision: 'allow' | 'backoff' | 'block' }).decision ?? 'allow';
    } catch {
      return 'allow';
    }
  }

  /**
   * Registra o RESULTADO da tentativa de login na Edge login-guard (phase='post_result').
   * É o ÚNICO caminho que (a) grava em auth_login_attempts (rate-limit FR-018) e
   * (b) audita login_sucesso/login_falha (FR-020) — a Edge só registra quando é chamada.
   * Fire-and-safe: nunca quebra o fluxo de UX. Chamado em AMBOS os ramos (sucesso e
   * falha de credencial) para preservar timing uniforme/anti-enumeração (SC-004).
   */
  private async _recordResult(
    email: string,
    success: boolean,
    metodo: 'password' | 'google',
    userId?: string,
  ): Promise<void> {
    try {
      await this.supabase.client.functions.invoke('login-guard', {
        body: {
          phase: 'post_result',
          email,
          success,
          user_id: userId,
          user_agent: this.isBrowser ? navigator.userAgent : undefined,
          detail: { metodo },
        },
      });
    } catch {
      // fire-and-safe: auditoria/rate-limit não pode quebrar o login.
    }
  }

  /**
   * Resolve o papel do usuário via RPC current_user_role().
   * FR-005/006: papel lido do banco (fonte de verdade) via RLS própria.
   * Retorna null se a RPC falhar (guard fica conservador → /app).
   */
  private async _resolveRole(): Promise<Role | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('current_user_role');
      if (error || !data) return null;
      const role = data as Role;
      this.store.setRole(role);
      return role;
    } catch {
      this.store.setRole(null);
      return null;
    }
  }

  /**
   * Classifica o erro do GoTrue em um reason interno.
   * NUNCA ramifica em mensagens diferentes por razão (anti-enumeração FR-014/019).
   * 'invalid' é o catch-all para credencial errada E conta inexistente.
   */
  private _classifyError(message: string): NonNullable<AuthResult['reason']> {
    const msg = message.toLowerCase();
    if (msg.includes('email not confirmed')) return 'unconfirmed';
    if (msg.includes('network') || msg.includes('fetch')) return 'network';
    // Tudo mais (invalid credentials, user not found, etc.) → 'invalid'
    // Isso garante timing e mensagem uniformes (SC-004).
    return 'invalid';
  }
}
