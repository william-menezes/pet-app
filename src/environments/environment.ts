/**
 * Ambiente de PRODUÇÃO (base). Apenas valores PÚBLICOS:
 * URL do Supabase + anon key (RLS protege os dados). NUNCA colocar segredos aqui —
 * service_role, chaves de pagamento/SMTP/geo vivem só em Edge Functions / env do servidor.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://orawzpslqvduwsvmlemv.supabase.co',
  supabaseAnonKey: 'sb_publishable_x8tQQCSOzBzznvxd9OfBEw_0_VZIL-u',
};
