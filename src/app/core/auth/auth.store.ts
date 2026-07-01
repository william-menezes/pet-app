/**
 * AuthStore — estado reativo de autenticação (signals).
 *
 * Somente-leitura para a UI. Toda mutação passa pelo AuthService.
 * O token NUNCA é lido por código fora de core/ (invariante anti-XSS T020d).
 *
 * Segurança: RLS no banco é a fonte de verdade. O papel aqui serve apenas para
 * rotear a UI — um guard burlado NÃO concede acesso a dados (is_admin() no banco).
 */
import { Injectable, signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';

export type Role = 'tutor' | 'admin';
export type AuthStatus = 'idle' | 'loading' | 'error';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  // ── sinais privados (mutáveis apenas internamente) ──
  private readonly _session = signal<Session | null>(null);
  private readonly _role = signal<Role | null>(null);
  private readonly _status = signal<AuthStatus>('idle');
  private readonly _errorMessage = signal<string | null>(null);

  // ── API pública (somente-leitura) ──
  readonly session = this._session.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly role = this._role.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly status = this._status.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();

  // ── mutações (chamadas apenas pelo AuthService) ──
  setSession(session: Session | null): void {
    this._session.set(session);
  }

  setRole(role: Role | null): void {
    this._role.set(role);
  }

  setStatus(status: AuthStatus): void {
    this._status.set(status);
  }

  setError(message: string | null): void {
    this._errorMessage.set(message);
    if (message !== null) this._status.set('error');
  }

  clearError(): void {
    this._errorMessage.set(null);
    if (this._status() === 'error') this._status.set('idle');
  }

  reset(): void {
    this._session.set(null);
    this._role.set(null);
    this._status.set('idle');
    this._errorMessage.set(null);
  }
}
