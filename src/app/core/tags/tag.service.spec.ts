import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../supabase/supabase.service';
import { TAG_ERRORS, tagErrorMessage } from './tag-errors';
import { TagService, isPinShape, normalizePin } from './tag.service';

// Código sintético do contrato (tag-code.vectors.json): válido pela regra.
const CODE = '7K3M-Q9XA-C';
const PET = '11111111-1111-4111-8111-111111111111';

describe('TagService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: TagService;

  beforeEach(() => {
    rpc = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });
    service = TestBed.inject(TagService);
  });

  describe('código antes do banco', () => {
    it('checkForLink com dígito errado não chama a RPC', async () => {
      expect(await service.checkForLink('7K3M-Q9XA-D')).toEqual({ ok: false, error: 'invalid_code' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('manda o código normalizado (sem hífen nem espaço, maiúsculas)', async () => {
      rpc.mockResolvedValue({ data: { ok: true, code: CODE }, error: null });
      await service.checkForLink('7k3m q9xa c');
      expect(rpc).toHaveBeenCalledWith('check_tag_for_link', { p_code: '7K3MQ9XAC' });
    });

    it('activate e setPendingActivation também validam antes', async () => {
      expect(await service.activate({ code: 'ABC', pin: 'K47Q9M', petId: PET, enableWhatsapp: true })).toEqual({
        ok: false,
        error: 'invalid_code',
      });
      expect(await service.setPendingActivation('xx')).toEqual({ ok: false, error: 'invalid_code' });
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('envia os cinco parâmetros, com o PIN normalizado e o WhatsApp explícito', async () => {
      rpc.mockResolvedValue({
        data: { ok: true, code: CODE, pet_id: PET, pet_name: 'Paçoca', whatsapp_enabled: true },
        error: null,
      });
      const res = await service.activate({ code: CODE, pin: 'k47q-9m', petId: PET, enableWhatsapp: true });
      expect(rpc).toHaveBeenCalledWith('activate_tag', {
        p_code: '7K3MQ9XAC',
        p_pin: 'K47Q9M',
        p_pet_id: PET,
        p_replace: false,
        p_enable_whatsapp: true,
      });
      expect(res).toEqual({ ok: true, code: CODE, petId: PET, petName: 'Paçoca', whatsappEnabled: true });
    });

    it('com WhatsApp desmarcado envia false (nunca omite) e com troca envia p_replace', async () => {
      rpc.mockResolvedValue({
        data: { ok: true, code: CODE, pet_id: PET, pet_name: 'Mel', whatsapp_enabled: false },
        error: null,
      });
      await service.activate({ code: CODE, pin: 'K47Q9M', petId: PET, replace: true, enableWhatsapp: false });
      expect(rpc.mock.calls[0][1]).toMatchObject({ p_replace: true, p_enable_whatsapp: false });
    });

    it('PIN que não tem seis caracteres do alfabeto não sai do aparelho', async () => {
      const res = await service.activate({ code: CODE, pin: 'K47Q9', petId: PET, enableWhatsapp: true });
      expect(res).toEqual({ ok: false, error: 'wrong_pin' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('resposta de sucesso sem pet_name é tratada como falha', async () => {
      rpc.mockResolvedValue({ data: { ok: true, code: CODE }, error: null });
      expect(await service.activate({ code: CODE, pin: 'K47Q9M', petId: PET, enableWhatsapp: true })).toEqual({
        ok: false,
        error: 'network',
      });
    });
  });

  describe('erros de negócio (cada código do contrato)', () => {
    for (const error of TAG_ERRORS) {
      it(`${error}: devolve o mesmo código, sem lançar, e há texto para ele`, async () => {
        rpc.mockResolvedValue({ data: { ok: false, error }, error: null });
        const res = await service.activate({ code: CODE, pin: 'K47Q9M', petId: PET, enableWhatsapp: true });
        expect(res).toEqual({ ok: false, error });
        expect(tagErrorMessage(error).length).toBeGreaterThan(5);
      });
    }

    it('locked leva retry_after_seconds', async () => {
      rpc.mockResolvedValue({ data: { ok: false, error: 'locked', retry_after_seconds: 540 }, error: null });
      const res = await service.activate({ code: CODE, pin: 'K47Q9M', petId: PET, enableWhatsapp: true });
      expect(res).toEqual({ ok: false, error: 'locked', retryAfterSeconds: 540 });
      expect(tagErrorMessage('locked', 540)).toBe('Muitas tentativas. Tente de novo em 9 minutos.');
    });

    it('código desconhecido, erro do cliente, exceção e corpo estranho viram network', async () => {
      rpc.mockResolvedValueOnce({ data: { ok: false, error: 'algo_novo' }, error: null });
      expect(await service.checkForLink(CODE)).toEqual({ ok: false, error: 'network' });
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'segredo interno' } });
      expect(await service.checkForLink(CODE)).toEqual({ ok: false, error: 'network' });
      rpc.mockRejectedValueOnce(new Error('offline'));
      expect(await service.checkForLink(CODE)).toEqual({ ok: false, error: 'network' });
      rpc.mockResolvedValueOnce({ data: 'texto', error: null });
      expect(await service.checkForLink(CODE)).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('ativação pendente', () => {
    it('set, get e clear', async () => {
      rpc.mockResolvedValue({ data: { ok: true }, error: null });
      expect(await service.setPendingActivation(CODE)).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('set_pending_activation', { p_code: '7K3MQ9XAC' });

      rpc.mockResolvedValue({ data: { ok: true, code: CODE }, error: null });
      expect(await service.getPendingActivation()).toEqual({ ok: true, code: CODE });
      rpc.mockResolvedValue({ data: { ok: true, code: null }, error: null });
      expect(await service.getPendingActivation()).toEqual({ ok: true, code: null });

      rpc.mockResolvedValue({ data: { ok: true }, error: null });
      expect(await service.clearPendingActivation()).toEqual({ ok: true });
      expect(rpc).toHaveBeenLastCalledWith('clear_pending_activation', undefined);
    });
  });

  describe('myDashboard', () => {
    it('converte os pets, com e sem tag', async () => {
      rpc.mockResolvedValue({
        data: {
          ok: true,
          pending_activation: CODE,
          pets: [
            {
              id: PET,
              name: 'Paçoca',
              species: 'dog',
              photo_path: null,
              lost_mode: false,
              lost_since: null,
              has_tag: true,
              tag_code: CODE,
              tag_status: 'assigned',
              scans_month: 3,
              last_scan: { occurred_at: '2026-11-20T10:00:00Z', geo_method: 'ip' },
              visible_shown: 3,
              visible_total: 5,
            },
            { id: 'p2', name: 'Mel', species: 'cat', has_tag: false, tag_code: null, tag_status: null },
          ],
        },
        error: null,
      });
      const res = await service.myDashboard();
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.dashboard.pendingActivation).toBe(CODE);
      expect(res.dashboard.pets[0]).toMatchObject({
        id: PET,
        hasTag: true,
        tagCode: CODE,
        tagStatus: 'assigned',
        scansMonth: 3,
        lastScan: { occurredAt: '2026-11-20T10:00:00Z', geoMethod: 'ip' },
      });
      expect(res.dashboard.pets[1]).toMatchObject({ id: 'p2', species: 'cat', hasTag: false, tagCode: null, lastScan: null });
    });

    it('pet fora do formato => network', async () => {
      rpc.mockResolvedValue({ data: { ok: true, pets: [{ id: 1 }] }, error: null });
      expect(await service.myDashboard()).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('setLostMode (T060)', () => {
    it('liga com o recado aparado e as duas opções, e manda os cinco parâmetros', async () => {
      rpc.mockResolvedValue({ data: { ok: true }, error: null });
      const res = await service.setLostMode({ petId: PET, on: true, message: '  Fale baixo.  ', showSince: true, showReward: false });
      expect(res).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('set_lost_mode', {
        p_pet_id: PET,
        p_on: true,
        p_message: 'Fale baixo.',
        p_show_since: true,
        p_show_reward: false,
      });
    });

    it('recado em branco vira null; desligar nunca manda recado', async () => {
      rpc.mockResolvedValue({ data: { ok: true }, error: null });
      await service.setLostMode({ petId: PET, on: true, message: '   ', showSince: true, showReward: true });
      expect(rpc.mock.calls[0][1]).toMatchObject({ p_message: null });
      await service.setLostMode({ petId: PET, on: false, message: 'ficou', showSince: true, showReward: true });
      expect(rpc.mock.calls[1][1]).toMatchObject({ p_on: false, p_message: null });
    });

    it('recado acima de 280 não sai do aparelho', async () => {
      const res = await service.setLostMode({ petId: PET, on: true, message: 'a'.repeat(281), showSince: true, showReward: false });
      expect(res.ok).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('no_active_tag e pet_not_found chegam como erro de negócio', async () => {
      rpc.mockResolvedValue({ data: { ok: false, error: 'no_active_tag' }, error: null });
      expect(await service.setLostMode({ petId: PET, on: true, showSince: true, showReward: false })).toEqual({
        ok: false,
        error: 'no_active_tag',
      });
      rpc.mockResolvedValue({ data: { ok: false, error: 'pet_not_found' }, error: null });
      expect(await service.setLostMode({ petId: PET, on: false, showSince: true, showReward: false })).toEqual({
        ok: false,
        error: 'pet_not_found',
      });
    });
  });

  describe('PIN', () => {
    it('normaliza como o código', () => {
      expect(normalizePin(' k47q-9m ')).toBe('K47Q9M');
      expect(normalizePin('lO0I1l')).toBe('100111');
    });
    it('seis caracteres do alfabeto', () => {
      expect(isPinShape('K47Q9M')).toBe(true);
      expect(isPinShape('K47Q9U')).toBe(false);
      expect(isPinShape('K47Q9')).toBe(false);
    });
  });
});
