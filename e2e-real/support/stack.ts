/**
 * Apoio do E2E com backend real (CI, Supabase local). Le a configuracao do ambiente do processo:
 *   E2E_SUPABASE_URL, E2E_ANON_KEY, E2E_SERVICE_KEY (chaves do stack local, lidas de `supabase status` no runner),
 *   E2E_MAIL_URL (coletor de e-mail; padrao Mailpit local). Nenhum valor e escrito em log.
 */
import { randomBytes } from 'node:crypto';

export const SMS_STUB_CODE = '424242';
export const TEST_PASSWORD = 'SenhaDeTeste12345';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variavel de ambiente ${name} ausente (o E2E real so roda no job do CI com Supabase local)`);
  return v;
}

export const stack = {
  get url(): string {
    return env('E2E_SUPABASE_URL');
  },
  get anonKey(): string {
    return env('E2E_ANON_KEY');
  },
  get serviceKey(): string {
    return env('E2E_SERVICE_KEY');
  },
};

export function uniqueEmail(tag = 'e2e'): string {
  return `${tag}+${Date.now().toString(36)}${randomBytes(3).toString('hex')}@faro.test`;
}

/** Celular brasileiro valido (DDD 11, 9 na frente) e unico por chamada: so digitos, sem mascara. */
export function uniquePhoneDigits(): string {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `119${n}`;
}

export function e164(digits: string): string {
  return `+55${digits}`;
}

async function json(res: Response): Promise<{ status: number; body: any }> {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const adminHeaders = () => ({
  apikey: stack.serviceKey,
  Authorization: `Bearer ${stack.serviceKey}`,
  'Content-Type': 'application/json',
});

/** Cria um usuario confirmado pela API de admin do stack local (nao passa pelo desafio nem pelo e-mail). */
export async function adminCreateUser(
  opts: { email?: string; password?: string; metadata?: Record<string, unknown> } = {},
): Promise<{ id: string; email: string; password: string }> {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? TEST_PASSWORD;
  const res = await json(
    await fetch(`${stack.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'Pessoa E2E', terms_version: '2026-11', ...opts.metadata },
      }),
    }),
  );
  if (res.status !== 200) throw new Error(`adminCreateUser: HTTP ${res.status}`);
  return { id: res.body.id, email, password };
}

export async function adminDeleteUser(id: string): Promise<void> {
  await fetch(`${stack.url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user: { id: string };
}

/** Entra por senha pela API do Auth (token proprio do usuario). Devolve status e, se houver, a sessao. */
export async function apiSignIn(
  email: string,
  password: string,
): Promise<{ status: number; session: Session | null; body: any }> {
  const r = await json(
    await fetch(`${stack.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: stack.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { status: r.status, session: r.status === 200 ? (r.body as Session) : null, body: r.body };
}

/** Chamada REST/RPC com o token de um usuario (ou, sem token, como anon). */
export async function rest(
  path: string,
  opts: { token?: string; method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  return json(
    await fetch(`${stack.url}/rest/v1/${path}`, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: {
        apikey: stack.anonKey,
        Authorization: `Bearer ${opts.token ?? stack.anonKey}`,
        'Content-Type': 'application/json',
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
}

/** Leitura como service_role (so para conferir o estado do banco depois de um fluxo). */
export async function serviceRest(path: string): Promise<{ status: number; body: any }> {
  return json(
    await fetch(`${stack.url}/rest/v1/${path}`, {
      headers: { apikey: stack.serviceKey, Authorization: `Bearer ${stack.serviceKey}` },
    }),
  );
}

export async function authGetUser(token: string): Promise<number> {
  const res = await fetch(`${stack.url}/auth/v1/user`, {
    headers: { apikey: stack.anonKey, Authorization: `Bearer ${token}` },
  });
  return res.status;
}

export async function refresh(refreshToken: string): Promise<number> {
  const res = await fetch(`${stack.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return res.status;
}
