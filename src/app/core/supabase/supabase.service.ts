import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Ponto único de acesso ao Supabase no cliente.
 *
 * Segurança (constituição III): usa SOMENTE a anon key — a RLS no Postgres é a fonte de
 * verdade. Nenhum segredo (service_role, chaves de pagamento/geo/SMTP) entra aqui; eles
 * vivem apenas em Edge Functions / env do servidor.
 *
 * SSR/LGPD: no servidor não persistimos sessão nem lemos token da URL (sem PII no
 * servidor público — alinha com Rescue-First e a rota pública anônima).
 *
 * Acesso a dados é centralizado em serviços de `core/` (nunca chamar daqui direto da view).
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        persistSession: this.isBrowser,
        autoRefreshToken: this.isBrowser,
        detectSessionInUrl: this.isBrowser,
      },
    },
  );
}
