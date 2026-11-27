import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import { PHOTO_PROCESSOR } from './image-resize';
import { PET_CARE_MAX, PHOTO_MAX_BYTES, PetService, toPetColumns } from './pet.service';

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PET = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Cliente simulado: cada `from('pets')` devolve uma cadeia que registra as chamadas e resolve com `result`. */
function setup(opts: { user?: boolean; processor?: (f: Blob) => Promise<Blob> } = {}) {
  const calls: { op: string; args: unknown[] }[] = [];
  let result: { data: unknown; error: unknown } = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single', 'maybeSingle']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args });
      return chain;
    };
  }
  chain['then'] = (resolve: (v: unknown) => unknown) => resolve(result);

  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const createSignedUrls = vi.fn();
  const list = vi.fn().mockResolvedValue({ data: [], error: null });
  const client = {
    from: vi.fn(() => chain),
    storage: { from: vi.fn(() => ({ upload, remove, createSignedUrls, list })) },
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: { client } },
      { provide: PHOTO_PROCESSOR, useValue: opts.processor ?? (async () => new Blob(['x'], { type: 'image/webp' })) },
    ],
  });
  if (opts.user !== false) {
    TestBed.inject(AuthStore).setSession({ user: { id: UID } } as never);
  }
  return {
    service: TestBed.inject(PetService),
    calls,
    upload,
    remove,
    list,
    createSignedUrls,
    client,
    setResult: (r: { data: unknown; error: unknown }) => (result = r),
  };
}

describe('toPetColumns', () => {
  it('só devolve as colunas informadas e apara os textos', () => {
    expect(toPetColumns({ name: ' Paçoca ', species: 'dog', breed: ' ', temperament: [' Foge fácil '] }, true)).toEqual({
      name: 'Paçoca',
      species: 'dog',
      breed: null,
      temperament: ['Foge fácil'],
    });
  });

  it('recusa nome vazio, nome longo, espécie ausente na criação, mais de 5 jeitos e cuidados longos', () => {
    expect(toPetColumns({ name: '  ', species: 'dog' }, true)).toBeNull();
    expect(toPetColumns({ name: 'x'.repeat(41), species: 'dog' }, true)).toBeNull();
    expect(toPetColumns({ name: 'Mel' }, true)).toBeNull();
    expect(toPetColumns({ temperament: ['a', 'b', 'c', 'd', 'e', 'f'] }, false)).toBeNull();
    expect(toPetColumns({ temperament: ['x'.repeat(31)] }, false)).toBeNull();
    expect(toPetColumns({ careNotes: 'x'.repeat(PET_CARE_MAX + 1) }, false)).toBeNull();
  });

  it('na edição aceita só parte dos campos', () => {
    expect(toPetColumns({ size: 'large' }, false)).toEqual({ size: 'large' });
  });
});

describe('PetService', () => {
  it('create: insere com o tutor logado, sem mandar coluna fora do contrato, e devolve o id', async () => {
    const t = setup();
    t.setResult({ data: { id: PET }, error: null });
    const res = await t.service.create({ name: 'Paçoca', species: 'dog', sex: 'male', size: 'medium', careNotes: 'Remédio' });
    expect(res).toEqual({ ok: true, petId: PET });
    const insert = t.calls.find((c) => c.op === 'insert')?.args[0] as Record<string, unknown>;
    expect(insert).toMatchObject({ tutor_id: UID, name: 'Paçoca', species: 'dog', sex: 'male', size: 'medium', care_notes: 'Remédio' });
    expect(Object.keys(insert)).not.toContain('photo_path');
  });

  it('create: dado inválido ou sem sessão não chama o banco', async () => {
    const t = setup();
    expect(await t.service.create({ name: '', species: 'cat' })).toEqual({ ok: false, error: 'invalid' });
    expect(t.client.from).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const s = setup({ user: false });
    expect(await s.service.create({ name: 'Mel', species: 'cat' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('create: erro do banco vira network', async () => {
    const t = setup();
    t.setResult({ data: null, error: { message: 'segredo' } });
    expect(await t.service.create({ name: 'Mel', species: 'cat' })).toEqual({ ok: false, error: 'network' });
  });

  it('create: o 21º pet (gatilho do banco, exceção P0001 com a mensagem pet_limit) vira pet_limit, não network', async () => {
    const t = setup();
    t.setResult({ data: null, error: { code: 'P0001', message: 'pet_limit', details: null, hint: 'No maximo 20 pets por conta' } });
    expect(await t.service.create({ name: 'Mel', species: 'cat' })).toEqual({ ok: false, error: 'pet_limit' });
  });

  it('update: nenhuma linha (pet de outro tutor) vira not_found; sucesso filtra pelo id', async () => {
    const t = setup();
    t.setResult({ data: [], error: null });
    expect(await t.service.update(PET, { name: 'Mel' })).toEqual({ ok: false, error: 'not_found' });
    t.setResult({ data: [{ id: PET }], error: null });
    expect(await t.service.update(PET, { name: 'Mel' })).toEqual({ ok: true });
    expect(t.calls.some((c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === PET)).toBe(true);
  });

  it('remove: apaga todos os arquivos da pasta <uid>/<pet>/ depois da linha', async () => {
    const t = setup();
    t.setResult({ data: null, error: null });
    t.list.mockResolvedValue({ data: [{ name: 'a.webp' }, { name: 'velha.jpg' }], error: null });
    expect(await t.service.remove(PET)).toEqual({ ok: true });
    expect(t.list).toHaveBeenCalledWith(`${UID}/${PET}`, { limit: 1000 });
    expect(t.remove).toHaveBeenCalledWith([`${UID}/${PET}/a.webp`, `${UID}/${PET}/velha.jpg`]);
  });

  it('remove: falha ao apagar as fotos não desfaz a remoção do pet (sucesso parcial)', async () => {
    const t = setup();
    t.setResult({ data: null, error: null });
    t.list.mockResolvedValue({ data: [{ name: 'a.webp' }], error: null });
    t.remove.mockResolvedValue({ error: { message: 'x' } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await t.service.remove(PET)).toEqual({ ok: true });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('remove: se a linha não sai, nenhuma foto é apagada', async () => {
    const t = setup();
    t.setResult({ data: null, error: { message: 'x' } });
    t.list.mockResolvedValue({ data: [{ name: 'a.webp' }], error: null });
    expect(await t.service.remove(PET)).toEqual({ ok: false, error: 'network' });
    expect(t.remove).not.toHaveBeenCalled();
  });

  it('remove: listagem que falhou antes é tentada de novo depois da linha', async () => {
    const t = setup();
    t.setResult({ data: null, error: null });
    t.list
      .mockResolvedValueOnce({ data: null, error: { message: 'x' } })
      .mockResolvedValueOnce({ data: [{ name: 'a.webp' }], error: null });
    expect(await t.service.remove(PET)).toEqual({ ok: true });
    expect(t.remove).toHaveBeenCalledWith([`${UID}/${PET}/a.webp`]);
  });

  it('remove e list', async () => {
    const t = setup();
    t.setResult({ data: null, error: null });
    expect(await t.service.remove(PET)).toEqual({ ok: true });
    t.setResult({
      data: [
        {
          id: PET,
          tutor_id: UID,
          name: 'Paçoca',
          species: 'dog',
          breed: null,
          sex: null,
          size: null,
          neutered: null,
          birth_month: null,
          temperament: null,
          care_notes: null,
          photo_path: null,
          created_at: 'a',
          updated_at: 'b',
        },
      ],
      error: null,
    });
    const res = await t.service.list();
    expect(res.ok && res.pets[0]).toMatchObject({ id: PET, tutorId: UID, temperament: [] });
  });

  it('get: devolve o pet; sem linha (RLS ou inexistente) é not_found; erro do banco é network', async () => {
    const t = setup();
    t.setResult({
      data: { id: PET, tutor_id: UID, name: 'Paçoca', species: 'dog', breed: 'SRD', sex: 'male', size: 'medium', neutered: true, birth_month: '2022-03-01', temperament: ['Dócil'], care_notes: null, photo_path: null, created_at: 'a', updated_at: 'b' },
      error: null,
    });
    const res = await t.service.get(PET);
    expect(res.ok && res.pet).toMatchObject({ id: PET, breed: 'SRD', birthMonth: '2022-03-01', temperament: ['Dócil'] });
    expect(t.calls.some((c) => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === PET)).toBe(true);
    t.setResult({ data: null, error: null });
    expect(await t.service.get(PET)).toEqual({ ok: false, error: 'not_found' });
    t.setResult({ data: null, error: { message: 'segredo' } });
    expect(await t.service.get(PET)).toEqual({ ok: false, error: 'network' });
  });

  describe('uploadPhoto', () => {
    it('sobe em pet-photos/<uid>/<pet>/<arquivo>.webp, grava o caminho e apaga a foto anterior', async () => {
      const t = setup();
      t.setResult({ data: [{ id: PET }], error: null });
      const res = await t.service.uploadPhoto(PET, new Blob(['img'], { type: 'image/jpeg' }), `${UID}/${PET}/velha.webp`);
      expect(res.ok).toBe(true);
      const path = t.upload.mock.calls[0][0] as string;
      expect(path).toMatch(new RegExp(`^${UID}/${PET}/[0-9a-f-]{36}\\.webp$`));
      expect(t.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/webp', upsert: false });
      expect(t.calls.find((c) => c.op === 'update')?.args[0]).toEqual({ photo_path: path });
      expect(t.remove).toHaveBeenCalledWith([`${UID}/${PET}/velha.webp`]);
    });

    it('navegador sem WebP: sobe JPEG, com extensão e contentType de acordo', async () => {
      const t = setup({ processor: async () => new Blob(['j'], { type: 'image/jpeg' }) });
      t.setResult({ data: [{ id: PET }], error: null });
      const res = await t.service.uploadPhoto(PET, new Blob(['img']));
      expect(res.ok).toBe(true);
      expect(t.upload.mock.calls[0][0]).toMatch(new RegExp(`^${UID}/${PET}/[0-9a-f-]{36}[.]jpg$`));
      expect(t.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg' });
    });

    it('arquivo que não vira imagem => unsupported, sem subir nada', async () => {
      const t = setup({ processor: () => Promise.reject(new Error('x')) });
      expect(await t.service.uploadPhoto(PET, new Blob(['pdf']))).toEqual({ ok: false, error: 'unsupported' });
      expect(t.upload).not.toHaveBeenCalled();
    });

    it('depois de processada, acima de 5 MiB => too_large', async () => {
      const big = new Blob([new Uint8Array(PHOTO_MAX_BYTES + 1)], { type: 'image/webp' });
      const t = setup({ processor: async () => big });
      expect(await t.service.uploadPhoto(PET, big)).toEqual({ ok: false, error: 'too_large' });
      expect(t.upload).not.toHaveBeenCalled();
    });

    it('se o caminho não grava no pet, apaga o arquivo enviado', async () => {
      const t = setup();
      t.setResult({ data: [], error: null });
      expect(await t.service.uploadPhoto(PET, new Blob(['i']))).toEqual({ ok: false, error: 'network' });
      expect(t.remove).toHaveBeenCalledTimes(1);
    });

    it('falha no upload => network', async () => {
      const t = setup();
      t.upload.mockResolvedValue({ error: { message: 'x' } });
      expect(await t.service.uploadPhoto(PET, new Blob(['i']))).toEqual({ ok: false, error: 'network' });
    });
  });

  describe('photoUrls', () => {
    it('assina só caminhos distintos e deixa de fora os que falharem', async () => {
      const t = setup();
      t.createSignedUrls.mockResolvedValue({
        data: [
          { path: 'a', signedUrl: 'https://x/a', error: null },
          { path: 'b', signedUrl: null, error: 'nope' },
        ],
        error: null,
      });
      expect(await t.service.photoUrls(['a', null, 'a', 'b'])).toEqual({ a: 'https://x/a' });
      expect(t.createSignedUrls).toHaveBeenCalledWith(['a', 'b'], 3600);
    });

    it('sem caminho, não chama o storage', async () => {
      const t = setup();
      expect(await t.service.photoUrls([null])).toEqual({});
      expect(t.createSignedUrls).not.toHaveBeenCalled();
    });
  });
});
