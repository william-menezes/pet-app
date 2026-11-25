/**
 * AccountService — T025 (spec 004)
 *
 * Leitura e escrita da conta do tutor. Único ponto que fala com o Supabase sobre a conta
 * (nenhuma tela chama o SDK). Contrato: contracts/frontend-services.contract.md §3.
 *
 * Segurança: nenhuma mensagem de erro do Supabase é exposta (só `reason`); nada de dado pessoal
 * em log. A regra de verdade está no banco (privilégio de coluna `UPDATE (nome)`, `accept_terms`).
 */
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import { Account, AccountStore } from './account.store';
import { TERMS_VERSION } from './terms';

/** Formato bruto devolvido por `my_account()` (data-model / account.rpc.md). */
interface MyAccountRow {
  id: string;
  nome: string;
  email: string;
  papel: 'tutor' | 'admin';
  celular: string | null;
  celular_confirmado_em: string | null;
  celular_pendente: string | null;
  termos_aceitos_em: string | null;
  termos_versao: string | null;
  tem_senha: boolean;
  provedores: string[] | null;
  criado_em: string;
}

const NAME_MIN = 2;
const NAME_MAX = 80;

function toAccount(row: MyAccountRow): Account {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papel: row.papel,
    celular: row.celular,
    celularConfirmadoEm: row.celular_confirmado_em,
    celularPendente: row.celular_pendente,
    termosAceitosEm: row.termos_aceitos_em,
    termosVersao: row.termos_versao,
    temSenha: row.tem_senha,
    provedores: row.provedores ?? [],
    criadoEm: row.criado_em,
  };
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly supabase = inject(SupabaseService);
  private readonly store = inject(AccountStore);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);

  /** Evita duas chamadas simultâneas a `my_account()` (guard + tela). */
  private inflight: Promise<Account | null> | null = null;

  /** Lê `my_account()`. Falha => `null` e `loaded` continua `false`. */
  load(force = false): Promise<Account | null> {
    if (!force && this.inflight) return this.inflight;
    const run = this.fetch().finally(() => {
      if (this.inflight === run) this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  /** Carrega só se ainda não carregou. */
  async ensureLoaded(): Promise<Account | null> {
    return this.store.account() ?? this.load();
  }

  async updateName(nome: string): Promise<{ ok: boolean; reason?: 'invalid' | 'network' }> {
    const trimmed = (nome ?? '').trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      return { ok: false, reason: 'invalid' };
    }
    const uid = this.authStore.user()?.id;
    if (!uid) return { ok: false, reason: 'network' };
    try {
      const { error } = await this.supabase.client
        .from('perfis')
        .update({ nome: trimmed })
        .eq('id', uid);
      if (error) return { ok: false, reason: 'network' };
      await this.load(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  async acceptTerms(): Promise<{ ok: boolean; reason?: 'network' }> {
    try {
      const { error } = await this.supabase.client.rpc('accept_terms', { p_versao: TERMS_VERSION });
      if (error) return { ok: false, reason: 'network' };
      await this.load(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  /** Registra a saída na auditoria (erro ignorado) e só então encerra a sessão. Nunca lança. */
  async logout(): Promise<void> {
    try {
      await this.supabase.client.rpc('log_logout');
    } catch {
      // a auditoria não pode impedir a pessoa de sair
    }
    try {
      await this.authService.signOut();
    } catch {
      // o signOut já zera os stores no `finally`
    }
  }

  private async fetch(): Promise<Account | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('my_account');
      if (error || !data) return null;
      const account = toAccount(data as MyAccountRow);
      this.store.set(account);
      return account;
    } catch {
      return null;
    }
  }
}
