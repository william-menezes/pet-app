/**
 * post-auth-navigation.ts — T026 (spec 004)
 *
 * Decide para onde ir depois de qualquer autenticação bem-sucedida (login, callback do Google,
 * confirmação de e-mail, aceite dos termos, confirmação do celular): aceite dos termos, celular,
 * destino guardado (`returnUrl`) ou a casa do papel.
 *
 * Contrato: specs/004-conta-tutor/contracts/frontend-services.contract.md §3.
 * Guards são experiência; a regra de verdade está no banco.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '../account/account.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthStore, type Role } from './auth.store';
import { markReturning } from './returning-visitor';
import { ReturnUrlService, sanitizeReturnUrl } from './return-url';
import { roleRedirect } from './role-redirect';

export interface NextStepInput {
  role: Role | null;
  termsAccepted: boolean;
  phoneConfirmed: boolean;
  returnUrl: string | null;
  skipPhone: boolean;
}

const TERMS_PATH = '/auth/termos';
const PHONE_PATH = '/auth/celular';
const RETURN_TO_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isAdminPath(url: string | null): url is string {
  if (url === null) return false;
  const path = url.split(/[?#]/)[0];
  return path === '/admin' || path.startsWith('/admin/');
}

function withReturnUrl(path: string, returnUrl: string | null): string {
  return returnUrl === null ? path : `${path}?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** Função pura: devolve a próxima rota (tabela de casos no contrato §3). */
export function nextStep(i: NextStepInput): string {
  if (i.role === 'admin') {
    return isAdminPath(i.returnUrl) ? i.returnUrl : '/admin';
  }
  if (!i.termsAccepted) return withReturnUrl(TERMS_PATH, i.returnUrl);
  if (!i.phoneConfirmed && !i.skipPhone) return withReturnUrl(PHONE_PATH, i.returnUrl);
  // Tutor nunca é mandado para /admin por um destino guardado.
  if (i.returnUrl !== null && !isAdminPath(i.returnUrl)) return i.returnUrl;
  return '/app';
}

@Injectable({ providedIn: 'root' })
export class PostAuthNavigator {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly authStore = inject(AuthStore);
  private readonly returnUrlService = inject(ReturnUrlService);
  private readonly supabase = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);

  async go(opts: { skipPhone?: boolean } = {}): Promise<boolean> {
    // 1. conta e papel
    const account = await this.accountService.load(true);
    const role = this.authStore.role() ?? account?.papel ?? null;

    // 2. destino guardado: sessionStorage primeiro, depois os metadados do usuário (até 7 dias)
    let returnUrl = this.returnUrlService.peek();
    const meta = this.authStore.user()?.user_metadata as Record<string, unknown> | undefined;
    const hadReturnToMeta = meta?.['return_to'] != null;
    if (returnUrl === null && hadReturnToMeta) {
      const at = Date.parse(String(meta?.['return_to_at'] ?? ''));
      const fresh = Number.isFinite(at) && Date.now() - at < RETURN_TO_MAX_AGE_MS;
      if (fresh) returnUrl = sanitizeReturnUrl(meta?.['return_to']);
    }

    // 3. destino. Conta não carregou (rede): não aplica aceite nem celular; o `termsGuard`
    // de /app confere de novo quando a conta carregar.
    const destination = account
      ? nextStep({
          role,
          termsAccepted: account.termosAceitosEm !== null,
          phoneConfirmed: account.celular !== null && account.celularConfirmadoEm !== null,
          returnUrl,
          skipPhone: opts.skipPhone === true,
        })
      : (returnUrl ?? roleRedirect(role));

    // 4. marca de quem já entrou neste navegador
    markReturning(this.platformId);

    // 5. só o destino final consome o destino guardado
    const isFinal = !destination.startsWith(TERMS_PATH) && !destination.startsWith(PHONE_PATH);
    if (isFinal) {
      this.returnUrlService.clear();
      if (hadReturnToMeta) {
        void this.clearReturnToMetadata();
      }
    }

    // 6. navegar
    return this.router.navigateByUrl(destination, { replaceUrl: true });
  }

  /** Sem aguardar: um erro aqui não pode atrasar a navegação. */
  private async clearReturnToMetadata(): Promise<void> {
    try {
      await this.supabase.client.auth.updateUser({ data: { return_to: null, return_to_at: null } });
    } catch {
      // o destino antigo expira sozinho em 7 dias
    }
  }
}
