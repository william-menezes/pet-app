import { handleScanApi, SCAN_API_MAX_BODY, type ScanApiRequest, type ScanRoute } from './scan-api';
import type { ServerEnv } from './server-env';

const KEY = 'k'.repeat(40);
const env: ServerEnv = { functionsUrl: 'https://p.supabase.co/functions/v1', ssrKey: KEY, ipHashSecret: 's'.repeat(40) };

const bytes = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const sameOrigin = { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };

function request(route: ScanRoute, body: ScanApiRequest['body'], headers: Record<string, string> = sameOrigin): ScanApiRequest {
  return { route, body, headers: { get: (name) => headers[name.toLowerCase()] ?? null } };
}
const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

describe('handleScanApi (T025, T104)', () => {
  describe('origem', () => {
    it('origem cruzada é recusada (403) sem chamar o upstream', async () => {
      const fetchFn = vi.fn<typeof fetch>();
      const cross = { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' };
      expect((await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), cross), { env, fetchFn })).status).toBe(403);
      const none = { 'content-type': 'application/json' };
      expect((await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), none), { env, fetchFn })).status).toBe(403);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('sem Sec-Fetch-Site, vale o Origin com o mesmo host', async () => {
      const ok = { origin: 'https://tagfaro.com.br', host: 'tagfaro.com.br', 'content-type': 'application/json' };
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: false }));
      expect((await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), ok), { env, fetchFn })).status).toBe(200);
      const bad = { ...ok, origin: 'https://outro.example' };
      expect((await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), bad), { env, fetchFn })).status).toBe(403);
    });
  });

  describe('corpo', () => {
    it('só JSON (415)', async () => {
      const text = { 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' };
      expect((await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), text), { env })).status).toBe(415);
      expect((await handleScanApi(request('scan', bytes({}), { 'sec-fetch-site': 'same-origin' }), { env })).status).toBe(415);
    });

    it('mais de 2 KB é recusado (413)', async () => {
      expect((await handleScanApi(request('scan', 'too_large'), { env })).status).toBe(413);
      const big = bytes({ code: 'A'.repeat(SCAN_API_MAX_BODY) });
      expect((await handleScanApi(request('scan', big), { env })).status).toBe(413);
    });

    it('chave desconhecida, tipo errado ou JSON inválido (400)', async () => {
      const status = async (route: ScanRoute, body: unknown) => (await handleScanApi(request(route, bytes(body)), { env })).status;
      expect(await status('scan', { code: '7K3MQ9XAC', ip_hash: 'x' })).toBe(400);
      expect(await status('scan', { code: 7 })).toBe(400);
      expect(await status('scan', {})).toBe(400);
      expect(await status('scan', '{nao é json')).toBe(400);
      expect(await status('scan', '[]')).toBe(400);
      expect(await status('location', { scan_token: 't', lat: 1, lng: 2 })).toBe(400);
      expect(await status('location', { scan_token: 't', lat: 100, lng: 2, accuracy_m: 5 })).toBe(400);
      expect(await status('location', { scan_token: 't', lat: 1, lng: 2, accuracy_m: 5, extra: 1 })).toBe(400);
      expect((await handleScanApi(request('scan', null), { env })).status).toBe(400);
    });
  });

  describe('POST /api/scan', () => {
    it('repassa código canônico, ip_hash e a posição aproximada; devolve só owner e scan_token', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: false, scan_token: 'tok', segredo: 'x' }));
      const headers = {
        ...sameOrigin,
        'x-vercel-forwarded-for': '203.0.113.9',
        'x-vercel-ip-latitude': '-23.55',
        'x-vercel-ip-longitude': '-46.63',
        'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
        'x-vercel-ip-country-region': 'SP',
        authorization: 'Bearer aaa.bbb.ccc',
      };
      const result = await handleScanApi(request('scan', bytes({ code: '7k3m-q9xa-c' }), headers), { env, fetchFn });
      expect(result).toEqual({ status: 200, body: { owner: false, scan_token: 'tok' } });
      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toBe('https://p.supabase.co/functions/v1/register-scan');
      expect((init?.headers as Record<string, string>)['x-faro-ssr-key']).toBe(KEY);
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      expect(body['action']).toBe('scan');
      expect(body['code']).toBe('7K3MQ9XAC');
      expect(body['ip_hash']).toMatch(/^[0-9a-f]{64}$/);
      expect(body['geo']).toEqual({ lat: -23.55, lng: -46.63, city: 'São Paulo', region: 'SP' });
      expect(body['user_jwt']).toBe('aaa.bbb.ccc');
      expect(init?.body as string).not.toContain('203.0.113.9');
    });

    it('sem cabeçalhos de geolocalização o scan segue sem `geo`', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: false }));
      await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' })), { env, fetchFn });
      const body = JSON.parse(fetchFn.mock.calls[0][1]?.body as string) as Record<string, unknown>;
      expect('geo' in body).toBe(false);
      expect('user_jwt' in body).toBe(false);
    });

    it('dono: devolve { owner: true } e nunca o token', async () => {
      const fetchFn = () => reply({ owner: true, scan_token: 'nao-deve-sair' });
      const result = await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' })), { env, fetchFn });
      expect(result).toEqual({ status: 200, body: { owner: true } });
    });

    it('código com dígito errado: { owner: false } sem chamar o upstream', async () => {
      const fetchFn = vi.fn<typeof fetch>();
      const result = await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAD' })), { env, fetchFn });
      expect(result).toEqual({ status: 200, body: { owner: false } });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falha do upstream, status ruim ou variável ausente: 200 { owner: false }', async () => {
      const neutral = { status: 200, body: { owner: false } };
      const body = bytes({ code: '7K3MQ9XAC' });
      expect(await handleScanApi(request('scan', body), { env, fetchFn: () => Promise.reject(new Error('x')) })).toEqual(neutral);
      expect(await handleScanApi(request('scan', body), { env, fetchFn: () => reply({}, 500) })).toEqual(neutral);
      expect(await handleScanApi(request('scan', body), { env, fetchFn: () => reply('texto') })).toEqual(neutral);
      const fetchFn = vi.fn<typeof fetch>();
      expect(await handleScanApi(request('scan', body), { env: { ...env, ssrKey: null }, fetchFn })).toEqual(neutral);
      expect(await handleScanApi(request('scan', body), { env: { ...env, ipHashSecret: null }, fetchFn })).toEqual(neutral);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('ignora Authorization que não tem cara de JWT', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: false }));
      await handleScanApi(request('scan', bytes({ code: '7K3MQ9XAC' }), { ...sameOrigin, authorization: 'Bearer lixo' }), { env, fetchFn });
      expect('user_jwt' in (JSON.parse(fetchFn.mock.calls[0][1]?.body as string) as object)).toBe(false);
    });
  });

  describe('POST /api/scan/location', () => {
    const payload = { scan_token: 'tok', lat: -23.5, lng: -46.6, accuracy_m: 12 };

    it('repassa a localização e devolve só { updated }', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ updated: true, notify: { to: 'ana@x.com' } }));
      expect(await handleScanApi(request('location', bytes(payload)), { env, fetchFn })).toEqual({ status: 200, body: { updated: true } });
      const body = JSON.parse(fetchFn.mock.calls[0][1]?.body as string) as Record<string, unknown>;
      expect(body).toEqual({ action: 'location', ...payload });
    });

    it('token inválido ou falha: 200 { updated: false }', async () => {
      expect(await handleScanApi(request('location', bytes(payload)), { env, fetchFn: () => reply({ updated: false }) })).toEqual({
        status: 200,
        body: { updated: false },
      });
      expect(await handleScanApi(request('location', bytes(payload)), { env, fetchFn: () => Promise.reject(new Error('x')) })).toEqual({
        status: 200,
        body: { updated: false },
      });
    });
  });
});
