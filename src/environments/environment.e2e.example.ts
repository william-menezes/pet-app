/**
 * Modelo do ambiente do E2E com backend real (CI). NAO tem valores.
 * O workflow (job `e2e`) escreve `environment.e2e.ts` DENTRO DO RUNNER a partir da URL e da chave anonima do
 * Supabase local; esse arquivo nunca e versionado (.gitignore). A configuracao `e2e` do Angular o usa por fileReplacements.
 * Chave de teste do Turnstile e opcional: vazia deixa o desafio desligado, como no stack local.
 */
export const environment = {
  production: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  turnstileSiteKey: '',
};
