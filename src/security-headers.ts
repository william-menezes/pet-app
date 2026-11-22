/**
 * security-headers.ts: fonte única dos cabeçalhos de segurança (spec 004, T105; contrato
 * `specs/004-conta-tutor/contracts/security-hardening.contract.md` §3).
 *
 * - `src/server.ts` usa `securityHeaders()` em toda resposta.
 * - `vercel.json` repete os mesmos valores (com `https: true`); `npm run check:headers`
 *   (`scripts/security/check-headers.mjs`) reprova se os dois divergirem. Este arquivo só pode ter
 *   sintaxe TypeScript apagável e nenhum import: o script o carrega direto pelo Node.
 *
 * Duas políticas, por tipo de documento:
 * - `tag`: a página de resgate (`/<código>` e `/<código>/perdido`). Nenhum host de terceiro e nenhum
 *   `frame-src`: o resgate nunca depende de um serviço externo (Princípio I).
 * - `app`: todo o resto (landing, `/auth`, `/app`, `/admin`, `/legal`). Libera o desafio anti-robô
 *   (Turnstile) em `script-src` e `frame-src`.
 *
 * ATENÇÃO (spec 003): a rota real da tag ainda não existe. Enquanto isso, `tag` vale para o PADRÃO de
 * caminho de um segmento de 9 a 11 caracteres do alfabeto do código (com ou sem hífens, que é o
 * `XXXX-XXXX-X` exibido), mais `/<segmento>/perdido`. A landing (`/`) e `/legal/*` ficam em `app`
 * de propósito: seus links para `/auth/login` são `routerLink` (navegação dentro do Angular, que não
 * troca a política). Quando a 003 criar a rota real, ela ajusta `TAG_SEGMENT` e `TAG_SOURCES` aqui e o
 * `vercel.json` é conferido por `check:headers`.
 */

export type HeaderKind = 'tag' | 'app';

export interface SecurityHeaderOptions {
  /** O pedido chegou por HTTPS. Liga `upgrade-insecure-requests` e HSTS (em `localhost` quebrariam o Supabase local). */
  https: boolean;
  /** Host do Supabase para `connect-src`. Padrão: qualquer projeto `*.supabase.co`. */
  supabaseHost?: string;
}

/** Domínio do desafio anti-robô. Só entra na política `app`. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Host padrão do Supabase quando `SUPABASE_URL` não está definida (é o valor do `vercel.json`). */
export const DEFAULT_SUPABASE_HOST = '*.supabase.co';

/**
 * Um segmento de 9 a 11 caracteres: o código (9) ou o código exibido com hífens (11). O alfabeto é o
 * Crockford normalizado mais `O`, `I`, `L` (que a entrada converte), em maiúsculas ou minúsculas.
 */
export const TAG_SEGMENT = '[0-9A-Za-z-]{9,11}';

/** Caminhos (em sintaxe de `source` da Vercel) que recebem a política `tag`. Com e sem barra final. */
export const TAG_SOURCES: readonly string[] = [
  `/:code(${TAG_SEGMENT})`,
  `/:code(${TAG_SEGMENT})/`,
  `/:code(${TAG_SEGMENT})/perdido`,
  `/:code(${TAG_SEGMENT})/perdido/`,
];

/** `source` da política `app`: tudo o que NÃO é caminho da tag. Mutuamente exclusivo com `TAG_SOURCES`. */
export const APP_SOURCE = `/((?!${TAG_SEGMENT}/?$|${TAG_SEGMENT}/perdido/?$).*)`;

const TAG_PATH = new RegExp(`^/${TAG_SEGMENT}(/perdido)?/?$`);

/** Política de um caminho (sem querystring). */
export function headerKindForPath(pathname: string): HeaderKind {
  return TAG_PATH.test(pathname) ? 'tag' : 'app';
}

/** O pedido chegou por HTTPS? Atrás da Vercel vale `x-forwarded-proto`. */
export function isHttpsRequest(
  forwardedProto: string | string[] | undefined,
  encrypted: boolean,
): boolean {
  if (encrypted) return true;
  const first = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return first?.split(',')[0]?.trim().toLowerCase() === 'https';
}

export function contentSecurityPolicy(kind: HeaderKind, options: SecurityHeaderOptions): string {
  const host = options.supabaseHost ?? DEFAULT_SUPABASE_HOST;
  const app = kind === 'app';
  const directives = [
    `default-src 'self'`,
    app ? `script-src 'self' ${TURNSTILE_ORIGIN}` : `script-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://${host} wss://${host}`,
    ...(app ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(options.https ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** Todos os cabeçalhos de segurança de uma política. */
export function securityHeaders(
  kind: HeaderKind,
  options: SecurityHeaderOptions,
): Record<string, string> {
  const app = kind === 'app';
  return {
    'Content-Security-Policy': contentSecurityPolicy(kind, options),
    ...(options.https ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
    'Referrer-Policy': app ? 'strict-origin-when-cross-origin' : 'no-referrer',
    'Permissions-Policy': app
      ? 'geolocation=(self), camera=(self), microphone=(), payment=(), usb=()'
      : 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': app ? 'same-origin-allow-popups' : 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}
