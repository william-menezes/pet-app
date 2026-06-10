/**
 * Ambiente de PRODUÇÃO (base). Apenas valores PÚBLICOS:
 * URL do Supabase + anon key (RLS protege os dados). NUNCA colocar segredos aqui —
 * service_role, chaves de pagamento/SMTP/geo vivem só em Edge Functions / env do servidor.
 */
export const environment = {
  production: true,
  // TODO(SUPABASE): substituir pelos valores do projeto (públicos).
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
