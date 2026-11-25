import { lostElapsed, parseResolveResponse } from './resolve-response';

const NOW = Date.parse('2026-11-21T12:00:00Z');
const full = {
  state: 'assigned',
  profile: {
    code: '7K3MQ9XAC',
    pet: { name: 'Paçoca', photo_url: 'https://x.supabase.co/storage/v1/object/sign/pet-photos/a.webp?token=t' },
    temperament: ['Dócil com pessoas', 'Medo de barulho'],
    care_notes: 'Toma remédio para alergia.',
    tutor_first_name: 'Ana',
    whatsapp_url: 'https://wa.me/5511987654421?text=Oi',
    phone_display: '(11) 98765-4421',
    lost: { since: '2026-11-19T10:00:00Z', reward: true, message: 'Ele se assusta.' },
  },
};

describe('parseResolveResponse (T029)', () => {
  it('assigned completo: copia os campos conhecidos e calcula o tempo no servidor', () => {
    const result = parseResolveResponse(full, NOW);
    expect(result).toEqual({
      state: 'assigned',
      profile: { ...full.profile, code: '7K3M-Q9XA-C' },
      lostElapsed: { unit: 'days', amount: 2 },
    });
  });

  it('campo ausente continua ausente (nunca vira null ou vazio)', () => {
    const result = parseResolveResponse({ state: 'assigned', profile: { code: '7K3MQ9XAC', pet: { name: 'Paçoca' } } }, NOW);
    expect(result).toEqual({ state: 'assigned', profile: { code: '7K3M-Q9XA-C', pet: { name: 'Paçoca' } } });
    if (result.state !== 'assigned') throw new Error('estado');
    expect(Object.keys(result.profile).sort()).toEqual(['code', 'pet']);
    expect(Object.keys(result.profile.pet)).toEqual(['name']);
    expect('lostElapsed' in result).toBe(false);
  });

  it('não copia campo desconhecido: nenhum identificador interno chega ao TransferState', () => {
    const dirty = {
      state: 'assigned',
      extra: 'x',
      profile: { code: '7K3MQ9XAC', pet: { name: 'Paçoca', id: 'uuid-do-pet' }, pet_id: 'uuid', tutor_id: 'uuid', ip_hash: 'h' },
    };
    const text = JSON.stringify(parseResolveResponse(dirty, NOW));
    expect(text).not.toMatch(/uuid|ip_hash|extra|tutor_id|pet_id/);
  });

  it('descarta esquemas perigosos e links fora do WhatsApp', () => {
    const result = parseResolveResponse(
      {
        state: 'assigned',
        profile: {
          code: '7K3MQ9XAC',
          pet: { name: 'Paçoca', photo_url: 'javascript:alert(1)' },
          whatsapp_url: 'https://evil.example/wa.me/55119',
        },
      },
      NOW,
    );
    if (result.state !== 'assigned') throw new Error('estado');
    expect(result.profile.pet.photo_url).toBeUndefined();
    expect(result.profile.whatsapp_url).toBeUndefined();
    expect(parseResolveResponse({ ...full, profile: { ...full.profile, whatsapp_url: 'http://wa.me/5511' } }, NOW)).toMatchObject({
      state: 'assigned',
    });
  });

  it('available, not_found; rate_limited e o resto viram contingência', () => {
    expect(parseResolveResponse({ state: 'available', code: '7K3MQ9XAC' }, NOW)).toEqual({ state: 'available', code: '7K3M-Q9XA-C' });
    expect(parseResolveResponse({ state: 'available', code: 'lixo' }, NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse({ state: 'not_found' }, NOW)).toEqual({ state: 'not_found' });
    expect(parseResolveResponse({ state: 'rate_limited' }, NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse({ state: 'rescue' }, NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse(null, NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse('x', NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse({ state: 'assigned' }, NOW)).toEqual({ state: 'contingency' });
    expect(parseResolveResponse({ state: 'assigned', profile: { code: '7K3MQ9XAC', pet: {} } }, NOW)).toEqual({
      state: 'contingency',
    });
  });
});

describe('lostElapsed', () => {
  const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();
  it('horas até 48 h, depois dias', () => {
    expect(lostElapsed(at(5), NOW)).toEqual({ unit: 'hours', amount: 5 });
    expect(lostElapsed(at(48), NOW)).toEqual({ unit: 'hours', amount: 48 });
    expect(lostElapsed(at(49), NOW)).toEqual({ unit: 'days', amount: 2 });
    expect(lostElapsed(at(24 * 7), NOW)).toEqual({ unit: 'days', amount: 7 });
  });
  it('no mínimo 1 hora e data inválida devolve null', () => {
    expect(lostElapsed(at(0), NOW)).toEqual({ unit: 'hours', amount: 1 });
    expect(lostElapsed('ontem', NOW)).toBeNull();
  });
});
