import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../supabase/supabase.service';
import { RescueProfileService, toRescueColumns } from './rescue-profile.service';

const PET = '11111111-1111-4111-8111-111111111111';

const row = {
  pet_id: PET,
  show_temperament: true,
  show_care: false,
  show_tutor_first_name: true,
  show_whatsapp: false,
  show_phone: false,
  lost_mode: true,
  lost_since: '2026-11-20T10:00:00Z',
  lost_message: 'Fale baixo.',
  lost_show_since: true,
  lost_show_reward: false,
  lost_show_message: true,
};

/** Cliente de mentira: cada passo da cadeia devolve o mesmo objeto; o último é a promessa. */
function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'select', 'update', 'eq']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain['maybeSingle'] = () => Promise.resolve(result);
  chain['then'] = (resolve: (v: unknown) => void) => resolve(result);
  return { calls, supabase: { client: chain } };
}

function service(result: { data: unknown; error: { message: string } | null }) {
  const mock = client(result);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: mock.supabase }] });
  return { svc: TestBed.inject(RescueProfileService), calls: mock.calls };
}

describe('RescueProfileService (T064)', () => {
  it('get traduz as colunas do banco', async () => {
    const { svc, calls } = service({ data: row, error: null });
    const res = await svc.get(PET);
    expect(res).toEqual({
      ok: true,
      profile: {
        petId: PET,
        showTemperament: true,
        showCare: false,
        showTutorFirstName: true,
        showWhatsapp: false,
        showPhone: false,
        lostMode: true,
        lostSince: '2026-11-20T10:00:00Z',
        lostMessage: 'Fale baixo.',
        lostShowSince: true,
        lostShowReward: false,
        lostShowMessage: true,
      },
    });
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['pet_id', PET]);
  });

  it('get de pet que não é do tutor (RLS não devolve linha): not_found', async () => {
    const { svc } = service({ data: null, error: null });
    expect(await svc.get(PET)).toEqual({ ok: false, error: 'not_found' });
  });

  it('get com erro do cliente: network, sem a mensagem do Supabase', async () => {
    const { svc } = service({ data: null, error: { message: 'boom segredo' } });
    expect(await svc.get(PET)).toEqual({ ok: false, error: 'network' });
  });

  it('save grava só as colunas permitidas, com os nomes do banco', async () => {
    const { svc, calls } = service({ data: [row], error: null });
    const res = await svc.save(PET, { showCare: false, showPhone: true });
    expect(res.ok).toBe(true);
    expect(calls.find((c) => c.method === 'update')?.args).toEqual([{ show_care: false, show_phone: true }]);
  });

  it('o gatilho do banco (phone_not_confirmed) vira erro de negócio', async () => {
    const { svc } = service({ data: null, error: { message: 'phone_not_confirmed' } });
    expect(await svc.save(PET, { showWhatsapp: true })).toEqual({ ok: false, error: 'phone_not_confirmed' });
  });

  it('nenhuma linha atualizada: not_found', async () => {
    const { svc } = service({ data: [], error: null });
    expect(await svc.save(PET, { showCare: true })).toEqual({ ok: false, error: 'not_found' });
  });

  it('toRescueColumns ignora o que não é boolean e as colunas do modo perdido', () => {
    expect(toRescueColumns({})).toBeNull();
    const patch = { showCare: true, lostMode: true, lostMessage: 'x' } as never;
    expect(toRescueColumns(patch)).toEqual({ show_care: true });
    expect(toRescueColumns({ lostShowMessage: false })).toEqual({ lost_show_message: false });
  });
});
