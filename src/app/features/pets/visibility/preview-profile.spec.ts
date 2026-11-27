import { buildPreviewProfile, changedVisibility, maskPhone, type PreviewInput, type Visibility } from './preview-profile';

const ALL_OFF: Visibility = {
  showTemperament: false,
  showCare: false,
  showTutorFirstName: false,
  showWhatsapp: false,
  showPhone: false,
  lostShowSince: false,
  lostShowReward: false,
  lostShowMessage: false,
};
const ALL_ON: Visibility = Object.fromEntries(Object.keys(ALL_OFF).map((k) => [k, true])) as unknown as Visibility;

const base: PreviewInput = {
  name: 'Paçoca',
  photoUrl: 'https://x.supabase.co/sign/a.webp?token=t',
  tagCode: '7K3M-Q9XA-C',
  temperament: ['Dócil com pessoas', 'Medo de barulho'],
  careNotes: '  Toma remédio para alergia.  ',
  tutorFirstName: 'Ana',
  phoneDisplay: '(11) 98765-4421',
  visibility: ALL_OFF,
  lost: { on: false, since: null, message: null },
};

describe('buildPreviewProfile (T066)', () => {
  it('tudo desligado: só nome, foto e código; nenhum campo `undefined` escondido', () => {
    const profile = buildPreviewProfile(base);
    expect(profile).toEqual({ code: '7K3M-Q9XA-C', pet: { name: 'Paçoca', photo_url: base.photoUrl } });
    expect('temperament' in profile).toBe(false);
    expect('lost' in profile).toBe(false);
  });

  it('cada interruptor liga o seu campo, aparado', () => {
    const profile = buildPreviewProfile({ ...base, visibility: { ...ALL_OFF, showTemperament: true, showCare: true, showTutorFirstName: true } });
    expect(profile.temperament).toEqual(['Dócil com pessoas', 'Medo de barulho']);
    expect(profile.care_notes).toBe('Toma remédio para alergia.');
    expect(profile.tutor_first_name).toBe('Ana');
    expect(profile.whatsapp_url).toBeUndefined();
    expect(profile.phone_display).toBeUndefined();
  });

  it('WhatsApp e telefone: o WhatsApp nunca vira um wa.me com o número; o telefone mostra o número do tutor', () => {
    const profile = buildPreviewProfile({ ...base, visibility: { ...ALL_OFF, showWhatsapp: true, showPhone: true } });
    expect(profile.whatsapp_url).toBe('https://wa.me/');
    expect(profile.whatsapp_url).not.toContain('5511');
    expect(profile.phone_display).toBe('(11) 98765-4421');
  });

  it('sem celular cadastrado, contato ligado não aparece (não há o que mostrar)', () => {
    const profile = buildPreviewProfile({ ...base, phoneDisplay: null, visibility: { ...ALL_OFF, showWhatsapp: true, showPhone: true } });
    expect(profile.whatsapp_url).toBeUndefined();
    expect(profile.phone_display).toBeUndefined();
  });

  it('ligado mas vazio não aparece: sem jeito, sem cuidados, sem nome', () => {
    const profile = buildPreviewProfile({
      ...base,
      temperament: [],
      careNotes: '   ',
      tutorFirstName: null,
      visibility: ALL_ON,
    });
    expect('temperament' in profile).toBe(false);
    expect('care_notes' in profile).toBe(false);
    expect('tutor_first_name' in profile).toBe(false);
  });

  it('sem foto, o campo da foto não existe', () => {
    expect(buildPreviewProfile({ ...base, photoUrl: null }).pet).toEqual({ name: 'Paçoca' });
  });

  it('sem tag, o código fica vazio (o rodapé não mostra "Tag")', () => {
    expect(buildPreviewProfile({ ...base, tagCode: null }).code).toBe('');
  });

  describe('modo perdido', () => {
    const since = '2026-11-23T10:00:00Z';
    const lostOn = { on: true, since, message: ' Fale baixo. ' };

    it('desligado: a projeção não tem `lost`, mesmo com as opções do modo perdido ligadas', () => {
      expect('lost' in buildPreviewProfile({ ...base, visibility: ALL_ON })).toBe(false);
    });

    it('ligado com as três opções: tempo, recompensa e recado', () => {
      expect(buildPreviewProfile({ ...base, visibility: ALL_ON, lost: lostOn }).lost).toEqual({ since, reward: true, message: 'Fale baixo.' });
    });

    it('cada opção desligada some; ligado sem nenhuma, `lost` existe e vazio (o bloco âmbar aparece)', () => {
      expect(buildPreviewProfile({ ...base, visibility: { ...ALL_ON, lostShowSince: false }, lost: lostOn }).lost).toEqual({ reward: true, message: 'Fale baixo.' });
      expect(buildPreviewProfile({ ...base, visibility: { ...ALL_ON, lostShowReward: false }, lost: lostOn }).lost).toEqual({ since, message: 'Fale baixo.' });
      expect(buildPreviewProfile({ ...base, visibility: { ...ALL_ON, lostShowMessage: false }, lost: lostOn }).lost).toEqual({ since, reward: true });
      expect(buildPreviewProfile({ ...base, visibility: ALL_OFF, lost: lostOn }).lost).toEqual({});
    });

    it('recado em branco não aparece', () => {
      expect(buildPreviewProfile({ ...base, visibility: ALL_ON, lost: { on: true, since, message: '  ' } }).lost).toEqual({ since, reward: true });
    });
  });
});

describe('changedVisibility', () => {
  it('só devolve o que mudou', () => {
    expect(changedVisibility(ALL_OFF, ALL_OFF)).toEqual({});
    expect(changedVisibility(ALL_OFF, { ...ALL_OFF, showCare: true, lostShowMessage: true })).toEqual({ showCare: true, lostShowMessage: true });
  });
});

describe('maskPhone', () => {
  it('esconde o meio do número', () => {
    expect(maskPhone('(11) 98765-4421')).toBe('(11) 9••••-4421');
  });
  it('formato desconhecido volta como veio', () => {
    expect(maskPhone('11 9876')).toBe('11 9876');
  });
});
