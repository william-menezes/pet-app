/**
 * Ambiente de DESENVOLVIMENTO (substitui environment.ts via fileReplacements).
 * Apenas valores PÚBLICOS (URL + anon key). Sem segredos no repositório.
 * Aponte para o Supabase local (`supabase start`) ou para um projeto de dev.
 */
export const environment = {
  production: false,
  // TODO(SUPABASE): valores do Supabase local/dev (públicos). Ex.: http://127.0.0.1:54321
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
