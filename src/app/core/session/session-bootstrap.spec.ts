import { PLATFORM_ID, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bootstrapSession } from './session-bootstrap';

const KEY = 'sb-abcdef-auth-token';

describe('bootstrapSession', () => {
  let restore: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let load: ReturnType<typeof vi.fn>;

  @Injectable()
  class FakeAuth {
    restoreSession = () => restore();
  }

  const run = (platform = 'browser') => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }, FakeAuth],
    });
    return TestBed.runInInjectionContext(() => bootstrapSession(load as never));
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    restore = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    load = vi.fn().mockResolvedValue({ AuthService: FakeAuth });
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('servidor: não faz nada', async () => {
    localStorage.setItem(KEY, '{}');
    await run('server');
    expect(load).not.toHaveBeenCalled();
  });

  it('sem chave: resolve sem importar nada', async () => {
    localStorage.setItem('outra-coisa', '1');
    await run();
    expect(load).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });

  it('chave no localStorage: importa e aguarda restoreSession', async () => {
    localStorage.setItem(KEY, '{}');
    let done = false;
    restore.mockImplementation(async () => {
      await Promise.resolve();
      done = true;
    });
    await run();
    expect(load).toHaveBeenCalledTimes(1);
    expect(done).toBe(true);
  });

  it('chave no sessionStorage também conta', async () => {
    sessionStorage.setItem(KEY, '{}');
    await run();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('erro no import ou no restoreSession: resolve sem lançar', async () => {
    localStorage.setItem(KEY, '{}');
    restore.mockRejectedValue(new Error('x'));
    await expect(run()).resolves.toBeUndefined();
    TestBed.resetTestingModule();
    load.mockRejectedValue(new Error('chunk'));
    await expect(run()).resolves.toBeUndefined();
  });
});
