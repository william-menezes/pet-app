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
