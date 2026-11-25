/**
 * server-env.ts — variáveis do servidor SSR (README, "Variáveis do servidor SSR"). Só código de servidor
 * importa este arquivo. Nada daqui chega ao navegador.
 */
export interface ServerEnv {
  /** URL base das Edge Functions, sem barra final. Nunca deduzida de `environment*.ts`. */
  functionsUrl: string | null;
  /** Chave `x-faro-ssr-key`: pelo menos 32 caracteres. */
  ssrKey: string | null;
  /** Segredo do HMAC do `ip_hash`: pelo menos 32 caracteres. */
  ipHashSecret: string | null;
}

export const MIN_SECRET_LENGTH = 32;

const secret = (value: string | undefined): string | null =>
  value !== undefined && value.length >= MIN_SECRET_LENGTH ? value : null;

function functionsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Lê as três variáveis de um objeto como `process.env`. Valor ausente ou curto demais vira `null`. */
export function readServerEnv(env: Record<string, string | undefined>): ServerEnv {
  return {
    functionsUrl: functionsUrl(env['SUPABASE_FUNCTIONS_URL']),
    ssrKey: secret(env['FARO_SSR_KEY']),
    ipHashSecret: secret(env['IP_HASH_SECRET']),
  };
}
