import { PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { TagResolution } from '../../models';
import { PublicTagService, tagStateKey } from './public-tag.service';
import { SERVER_TAG_RESOLVER, type ServerTagResolver } from './tag-resolver.token';

const CODE = '7K3MQ9XAC';
const rescue: TagResolution = {
  state: 'assigned',
  profile: { code: '7K3M-Q9XA-C', pet: { name: 'Paçoca' } },
};

function setup(platform: 'server' | 'browser', resolver?: ServerTagResolver) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      ...(resolver ? [{ provide: SERVER_TAG_RESOLVER, useValue: resolver }] : []),
    ],
  });
  return { service: TestBed.inject(PublicTagService), state: TestBed.inject(TransferState) };
}

describe('PublicTagService (T029)', () => {
  describe('no servidor', () => {
    it('chama o resolvedor com o código canônico e guarda o resultado no TransferState', async () => {
      const resolver = vi.fn<ServerTagResolver>().mockResolvedValue(rescue);
      const { service, state } = setup('server', resolver);
      expect(await service.resolve('7k3m-q9xa-c')).toEqual(rescue);
      expect(resolver).toHaveBeenCalledWith(CODE);
      expect(state.get(tagStateKey(CODE), null)).toEqual(rescue);
    });

    it('guarda também "não ativada" e "não encontrada"', async () => {
      const available: TagResolution = { state: 'available', code: '7K3M-Q9XA-C' };
      const { service } = setup('server', vi.fn<ServerTagResolver>().mockResolvedValue(available));
      expect(await service.resolve(CODE)).toEqual(available);
    });

    it('erro do resolvedor vira contingência, sem lançar', async () => {
      const { service } = setup('server', vi.fn<ServerTagResolver>().mockRejectedValue(new Error('rede')));
      expect(await service.resolve(CODE)).toEqual({ state: 'contingency' });
    });

    it('tempo esgotado vira contingência', async () => {
      const slow: ServerTagResolver = () => new Promise(() => undefined);
      const { service, state } = setup('server', slow);
      expect(await service.resolve(CODE, 20)).toEqual({ state: 'contingency' });
      expect(state.get(tagStateKey(CODE), null)).toEqual({ state: 'contingency' });
    });

    it('sem resolvedor (servidor mal configurado) vira contingência', async () => {
      const { service } = setup('server');
      expect(await service.resolve(CODE)).toEqual({ state: 'contingency' });
    });

    it('código com dígito errado é "não encontrada" e o resolvedor NÃO é chamado', async () => {
      const resolver = vi.fn<ServerTagResolver>().mockResolvedValue(rescue);
      const { service } = setup('server', resolver);
      expect(await service.resolve('7K3M-Q9XA-D')).toEqual({ state: 'not_found' });
      expect(await service.resolve('???')).toEqual({ state: 'not_found' });
      expect(resolver).not.toHaveBeenCalled();
    });
  });

  describe('no navegador', () => {
    it('só lê o estado transferido', async () => {
      const resolver = vi.fn<ServerTagResolver>().mockResolvedValue({ state: 'not_found' });
      const { service, state } = setup('browser', resolver);
      state.set(tagStateKey(CODE), rescue);
      expect(await service.resolve('7K3M-Q9XA-C')).toEqual(rescue);
      expect(resolver).not.toHaveBeenCalled();
    });

    it('sem estado transferido devolve contingência (o "Tentar de novo" refaz o pedido ao servidor)', async () => {
      const { service } = setup('browser');
      expect(await service.resolve(CODE)).toEqual({ state: 'contingency' });
    });

    it('dígito errado continua "não encontrada" sem rede', async () => {
      const { service } = setup('browser');
      expect(await service.resolve('7K3MQ9XAD')).toEqual({ state: 'not_found' });
    });
  });
});

describe('PublicTagService: piso de 150 ms (T104)', () => {
  afterEach(() => vi.useRealTimers());

  /** Tempo que `resolve` leva, com o relógio simulado. */
  async function elapsed(platform: 'server' | 'browser', raw: string, resolver?: ServerTagResolver): Promise<number> {
    vi.useFakeTimers();
    const { service } = setup(platform, resolver);
    const started = Date.now();
    let done = false;
    const pending = service.resolve(raw).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    for (let step = 0; step < 400 && !done; step++) await vi.advanceTimersByTimeAsync(1);
    await pending;
    return Date.now() - started;
  }

  it('no servidor, "não encontrada" por dígito errado (sem rede) também leva 150 ms', async () => {
    const resolver = vi.fn<ServerTagResolver>();
    expect(await elapsed('server', '7K3M-Q9XA-D', resolver)).toBeGreaterThanOrEqual(150);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('no servidor, "não encontrada", "não ativada" e contingência levam pelo menos 150 ms', async () => {
    const states: TagResolution[] = [{ state: 'not_found' }, { state: 'available', code: '7K3M-Q9XA-C' }, { state: 'contingency' }];
    for (const state of states) {
      TestBed.resetTestingModule();
      expect(await elapsed('server', CODE, vi.fn<ServerTagResolver>().mockResolvedValue(state)), state.state).toBeGreaterThanOrEqual(150);
    }
  });

  it('a página de resgate não espera nada além do que a chamada levou', async () => {
    expect(await elapsed('server', CODE, vi.fn<ServerTagResolver>().mockResolvedValue(rescue))).toBeLessThan(50);
  });

  it('no navegador não há espera: ele só lê o estado transferido', async () => {
    expect(await elapsed('browser', CODE)).toBeLessThan(50);
  });

  it('quem já demorou mais que o piso não espera mais', async () => {
    vi.useFakeTimers();
    const slow: ServerTagResolver = () => new Promise((resolve) => setTimeout(() => resolve({ state: 'not_found' }), 400));
    const { service } = setup('server', slow);
    const started = Date.now();
    const pending = service.resolve(CODE);
    await vi.advanceTimersByTimeAsync(400);
    await pending;
    expect(Date.now() - started).toBe(400);
  });
});
