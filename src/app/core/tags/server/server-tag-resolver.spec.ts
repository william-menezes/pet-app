import { createHmac } from 'node:crypto';

import { clientIp, ipHash, UNKNOWN_IP } from './client-ip';
import { createServerTagResolver } from './server-tag-resolver';
import { readServerEnv, type ServerEnv } from './server-env';

const KEY = 'k'.repeat(40);
const SECRET = 's'.repeat(40);
const env: ServerEnv = { functionsUrl: 'https://p.supabase.co/functions/v1', ssrKey: KEY, ipHashSecret: SECRET };
const headers = (map: Record<string, string>) => ({ get: (name: string) => map[name.toLowerCase()] ?? null });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('server-tag-resolver (T029)', () => {
  it('chama resolve-tag com a chave, o código e só o HMAC do IP', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => json({ state: 'not_found' }));
    const resolve = createServerTagResolver({ env, headers: headers({ 'x-vercel-forwarded-for': '203.0.113.9' }), fetchFn });
    expect(await resolve('7K3MQ9XAC')).toEqual({ state: 'not_found' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://p.supabase.co/functions/v1/resolve-tag');
    expect((init?.headers as Record<string, string>)['x-faro-ssr-key']).toBe(KEY);
    const body = JSON.parse(init?.body as string) as Record<string, string>;
    expect(body).toEqual({ code: '7K3MQ9XAC', ip_hash: createHmac('sha256', SECRET).update('203.0.113.9').digest('hex') });
    expect(init?.body as string).not.toContain('203.0.113.9');
  });

  it('variável ausente: nenhuma chamada de rede e contingência', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    for (const missing of [{ functionsUrl: null }, { ssrKey: null }, { ipHashSecret: null }]) {
      const resolve = createServerTagResolver({ env: { ...env, ...missing }, headers: null, fetchFn });
      expect(await resolve('7K3MQ9XAC')).toEqual({ state: 'contingency' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('status diferente de 200, JSON inválido e erro de rede viram contingência', async () => {
    const make = (fetchFn: typeof fetch) => createServerTagResolver({ env, headers: null, fetchFn });
    expect(await make(() => json({}, 401))('7K3MQ9XAC')).toEqual({ state: 'contingency' });
    expect(await make(() => json({}, 500))('7K3MQ9XAC')).toEqual({ state: 'contingency' });
    expect(await make(() => Promise.resolve(new Response('não é json')))('7K3MQ9XAC')).toEqual({ state: 'contingency' });
    expect(await make(() => Promise.reject(new Error('rede')))('7K3MQ9XAC')).toEqual({ state: 'contingency' });
  });

  it('rate_limited da função vira contingência', async () => {
    const resolve = createServerTagResolver({ env, headers: null, fetchFn: () => json({ state: 'rate_limited' }) });
    expect(await resolve('7K3MQ9XAC')).toEqual({ state: 'contingency' });
  });
});

describe('client-ip', () => {
  it('usa só os cabeçalhos da Vercel, na ordem: x-vercel-forwarded-for, x-real-ip', () => {
    expect(clientIp(headers({ 'x-vercel-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-real-ip': '3.3.3.3' }))).toBe('1.1.1.1');
    expect(clientIp(headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
  });
  it('ignora x-forwarded-for (o cliente pode escrevê-lo) e cai em "unknown"', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '9.9.9.9' }))).toBe(UNKNOWN_IP);
    expect(clientIp(headers({}))).toBe(UNKNOWN_IP);
  });
  it('ip_hash é o HMAC-SHA256 em hexadecimal', () => {
    expect(ipHash('segredo', '1.1.1.1')).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash('a', 'x')).not.toBe(ipHash('b', 'x'));
  });
});

describe('readServerEnv', () => {
  it('segredo com menos de 32 caracteres ou ausente vira null; URL sem barra final', () => {
    const vars = Object.fromEntries([
      ['FARO_SSR_KEY', 'curta'],
      ['IP_HASH_SECRET', SECRET],
      ['SUPABASE_FUNCTIONS_URL', 'https://p.supabase.co/functions/v1/'],
    ]);
    expect(readServerEnv(vars)).toEqual({
      functionsUrl: 'https://p.supabase.co/functions/v1',
      ssrKey: null,
      ipHashSecret: SECRET,
    });
    expect(readServerEnv({})).toEqual({ functionsUrl: null, ssrKey: null, ipHashSecret: null });
    expect(readServerEnv({ SUPABASE_FUNCTIONS_URL: 'ftp://x' }).functionsUrl).toBeNull();
    expect(readServerEnv({ SUPABASE_FUNCTIONS_URL: 'lixo' }).functionsUrl).toBeNull();
  });
});
