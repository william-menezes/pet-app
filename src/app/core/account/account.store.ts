/**
 * AccountStore — T025 (spec 004)
 *
 * Estado reativo da conta do tutor (dados de `my_account()`). Somente-leitura para a UI.
 * Mutações só por `AccountService`; `AuthService.signOut()` chama `reset()` quando a sessão termina.
 *
 * Não guarda senha, token nem código de SMS. A autorização real é o banco (RLS/privilégios):
 * estes sinais só decidem o que a tela mostra.
 */
import { Injectable, computed, signal } from '@angular/core';

export interface Account {
  id: string;
  nome: string;
  email: string;
  papel: 'tutor' | 'admin';
  celular: string | null;
  celularConfirmadoEm: string | null;
  celularPendente: string | null;
  termosAceitosEm: string | null;
  termosVersao: string | null;
  temSenha: boolean;
  provedores: string[];
  criadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly _account = signal<Account | null>(null);

  readonly account = this._account.asReadonly();
  readonly loaded = computed(() => this._account() !== null);
  readonly termsAccepted = computed(() => this._account()?.termosAceitosEm != null);
  readonly phoneConfirmed = computed(() => {
    const a = this._account();
    return a !== null && a.celular !== null && a.celularConfirmadoEm !== null;
  });
  readonly hasPassword = computed(() => this._account()?.temSenha === true);
  readonly isGoogleOnly = computed(() => {
    const a = this._account();
    return a !== null && !a.temSenha && a.provedores.includes('google');
  });

  /** Chamado só pelo `AccountService`. */
  set(account: Account): void {
    this._account.set(account);
  }

  /** Chamado pelo `AccountService` e pelo `AuthService.signOut()`. */
  reset(): void {
    this._account.set(null);
  }
}
