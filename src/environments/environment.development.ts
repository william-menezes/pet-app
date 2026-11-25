/**
 * Ambiente de DESENVOLVIMENTO (substitui environment.ts via fileReplacements).
 * Apenas valores PÚBLICOS (URL + anon key). Sem segredos no repositório.
 * Aponte para o Supabase local (`supabase start`) ou para um projeto de dev.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://orawzpslqvduwsvmlemv.supabase.co',
  supabaseAnonKey: 'sb_publishable_x8tQQCSOzBzznvxd9OfBEw_0_VZIL-u',
  /** Chave pública do Turnstile. Vazia = desafio desligado. A chave de produção ainda não existe (conta Cloudflare). */
  turnstileSiteKey: '',
};
