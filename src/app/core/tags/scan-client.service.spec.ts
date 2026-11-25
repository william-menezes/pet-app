import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OwnerProbe, storedAccessToken } from './owner-probe.service';
import { ScanClient } from './scan-client.service';

const KEY = 'sb-abcdef-auth-token';

/** JWT de mentira: só o payload com `exp` importa para a sonda. */
function jwt(exp: number): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${part({ alg: 'none' })}.${part({ exp })}.assinatura`;
}
const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

describe('OwnerProbe (T048)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  function probe(platform = 'browser') {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(OwnerProbe);
  }

  it('sem chave de sessão em nenhuma das duas storages: não importa nada e devolve null', async () => {
    const load = vi.fn();
    expect(await probe().accessToken(load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('no servidor nunca procura nada', async () => {
    localStorage.setItem(KEY, '{}');
    const load = vi.fn();
    expect(await probe('server').accessToken(load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('com chave no localStorage: importa o cliente e usa o token da sessão', async () => {
    localStorage.setItem(KEY, '{}');
    class Fake {
      client = { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'token-do-cliente' } } }) } };
    }
    const load = vi.fn().mockResolvedValue({ SupabaseService: Fake });
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }, Fake],
    });
    expect(await TestBed.inject(OwnerProbe).accessToken(load)).toBe('token-do-cliente');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('com chave só no sessionStorage (sessão volátil): usa o token gravado se ainda vale', async () => {
    const token = jwt(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem(KEY, JSON.stringify({ access_token: token }));
    class Fake {
      client = { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
    }
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }, Fake] });
    expect(await TestBed.inject(OwnerProbe).accessToken(() => Promise.resolve({ SupabaseService: Fake }))).toBe(token);
  });

  it('token gravado vencido ou ilegível não é usado; falha ao importar devolve null', async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ access_token: jwt(Math.floor(Date.now() / 1000) - 10) }));
    expect(storedAccessToken()).toBeNull();
    sessionStorage.setItem(KEY, 'isto não é json');
    expect(storedAccessToken()).toBeNull();
    expect(await probe().accessToken(() => Promise.reject(new Error('chunk')))).toBeNull();
  });
});

describe('ScanClient (T054)', () => {
  function client(platform = 'browser', token: string | null = null) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: OwnerProbe, useValue: { accessToken: () => Promise.resolve(token) } },
      ],
    });
    return TestBed.inject(ScanClient);
  }

  it('registerScan: POST /api/scan só com o código; sem sessão, sem Authorization', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: false, scan_token: 'tok' }));
    expect(await client().registerScan('7K3MQ9XAC', fetchFn)).toEqual({ owner: false, scan_token: 'tok' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/scan');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: '7K3MQ9XAC' });
    expect((init?.headers as Record<string, string>)['authorization']).toBeUndefined();
  });

  it('registerScan com sessão manda o token em Authorization: Bearer', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ owner: true }));
    expect(await client('browser', 'abc.def.ghi').registerScan('7K3MQ9XAC', fetchFn)).toEqual({ owner: true });
    expect((fetchFn.mock.calls[0][1]?.headers as Record<string, string>)['authorization']).toBe('Bearer abc.def.ghi');
  });

  it('registerScan: qualquer falha vira { owner: false }; no servidor nem chama', async () => {
    expect(await client().registerScan('7K3MQ9XAC', () => reply({}, 500))).toEqual({ owner: false });
    expect(await client().registerScan('7K3MQ9XAC', () => Promise.reject(new Error('rede')))).toEqual({ owner: false });
    expect(await client().registerScan('7K3MQ9XAC', () => reply('texto'))).toEqual({ owner: false });
    TestBed.resetTestingModule();
    const fetchFn = vi.fn<typeof fetch>();
    expect(await client('server').registerScan('7K3MQ9XAC', fetchFn)).toEqual({ owner: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sendLocation: POST /api/scan/location com o token e a margem arredondada', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => reply({ updated: true }));
    expect(await client().sendLocation('tok', { lat: -23.5, lng: -46.6, accuracyM: 12.6 }, fetchFn)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/scan/location');
    expect(JSON.parse(init?.body as string)).toEqual({ scan_token: 'tok', lat: -23.5, lng: -46.6, accuracy_m: 13 });
  });

  it('sendLocation: { updated: false }, status ruim e erro de rede devolvem false', async () => {
    const position = { lat: 1, lng: 2, accuracyM: 3 };
    expect(await client().sendLocation('t', position, () => reply({ updated: false }))).toBe(false);
    expect(await client().sendLocation('t', position, () => reply({}, 400))).toBe(false);
    expect(await client().sendLocation('t', position, () => Promise.reject(new Error('x')))).toBe(false);
  });
});
