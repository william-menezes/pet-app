import { unregisterServiceWorkers } from './unregister-service-workers';

describe('unregisterServiceWorkers', () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  function stubServiceWorker(value: unknown) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: value === undefined ? {} : { serviceWorker: value } });
  }
  function stubCaches(value: unknown) {
    vi.stubGlobal('caches', value);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  });

  it('cancela todos os registros', async () => {
    const unregister = [vi.fn().mockResolvedValue(true), vi.fn().mockResolvedValue(true)];
    stubServiceWorker({ getRegistrations: () => Promise.resolve(unregister.map((u) => ({ unregister: u }))) });
    stubCaches({ keys: () => Promise.resolve([]), delete: vi.fn() });
    await unregisterServiceWorkers();
    expect(unregister[0]).toHaveBeenCalledTimes(1);
    expect(unregister[1]).toHaveBeenCalledTimes(1);
  });

  it('apaga só os caches ngsw:*', async () => {
    stubServiceWorker({ getRegistrations: () => Promise.resolve([]) });
    const del = vi.fn().mockResolvedValue(true);
    stubCaches({ keys: () => Promise.resolve(['ngsw:/:db:control', 'ngsw:/:1:assets', 'outro-cache', 'meu-ngsw:x']), delete: del });
    await unregisterServiceWorkers();
    expect(del.mock.calls.map((c) => c[0])).toEqual(['ngsw:/:db:control', 'ngsw:/:1:assets']);
  });

  it('uma rejeição não vira exceção e o outro passo ainda roda', async () => {
    stubServiceWorker({ getRegistrations: () => Promise.reject(new Error('negado')) });
    const del = vi.fn().mockResolvedValue(true);
    stubCaches({ keys: () => Promise.resolve(['ngsw:a']), delete: del });
    await expect(unregisterServiceWorkers()).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('ngsw:a');
  });

  it('um registro que falha ao cancelar não impede os outros', async () => {
    const ok = vi.fn().mockResolvedValue(true);
    stubServiceWorker({ getRegistrations: () => Promise.resolve([{ unregister: () => Promise.reject(new Error('x')) }, { unregister: ok }]) });
    stubCaches({ keys: () => Promise.resolve([]), delete: vi.fn() });
    await expect(unregisterServiceWorkers()).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('uma rejeição ao listar os caches não vira exceção', async () => {
    stubServiceWorker({ getRegistrations: () => Promise.resolve([]) });
    stubCaches({ keys: () => Promise.reject(new Error('negado')), delete: vi.fn() });
    await expect(unregisterServiceWorkers()).resolves.toBeUndefined();
  });

  it('sem serviceWorker no navigator, termina sem erro', async () => {
    stubServiceWorker(undefined);
    stubCaches(undefined);
    await expect(unregisterServiceWorkers()).resolves.toBeUndefined();
  });
});
