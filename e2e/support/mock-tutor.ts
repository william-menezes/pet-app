import type { Page } from '@playwright/test';

import { makePng } from './png';

/**
 * Backend SIMULADO do tutor logado, para as telas de fluxo da 003 (ativação, novo pet, scans).
 *
 * O `ng serve` aponta para o projeto Supabase hospedado: tudo que vai para `*.supabase.co` é bloqueado (`abort`)
 * e só as poucas respostas de que as telas precisam são simuladas. Nada aqui cria conta nem escreve no projeto
 * real. A prova contra o banco de verdade é do QA (`e2e-real/`).
 */
const SESSION_KEY = 'sb-orawzpslqvduwsvmlemv-auth-token';

const b64url = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const NOW = Math.floor(Date.now() / 1000);
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', role: 'authenticated', exp: NOW + 3600 })}.assinatura`;

export const SESSION = {
  access_token: JWT,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: NOW + 3600,
  refresh_token: 'refresh-simulado',
  user: {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ana@email.com',
    email_confirmed_at: '2026-11-22T10:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-11-22T09:00:00Z',
  },
};

export interface MockPet {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  hasTag?: boolean;
  tagCode?: string | null;
  lostMode?: boolean;
  lostSince?: string | null;
  scansMonth?: number;
  lastScan?: { occurred_at: string; geo_method: string } | null;
  visibleShown?: number;
}

/** Perfil de resgate simulado (colunas de `rescue_profiles`). */
export type MockProfile = Record<string, unknown>;

export const defaultProfile = (petId: string): MockProfile => ({
  pet_id: petId,
  show_temperament: true,
  show_care: true,
  show_tutor_first_name: false,
  show_whatsapp: false,
  show_phone: false,
  lost_mode: false,
  lost_since: null,
  lost_message: null,
  lost_show_since: true,
  lost_show_reward: false,
  lost_show_message: true,
});

export interface TutorState {
  phoneConfirmed: boolean;
  pets: MockPet[];
  /** Respostas simuladas de `activate_tag`, em ordem; a última se repete. */
  activateReplies: unknown[];
  activateBodies: unknown[];
  /** Corpos das inserções em `pets` (novo pet). */
  petInserts: unknown[];
  /** Caminhos enviados ao bucket `pet-photos`. */
  uploads: string[];
  pendingCodes: string[];
  /** Linhas simuladas de `my_scans` (colunas da visão). */
  scansRows: unknown[];
  /** Consultas recebidas em `my_scans` (a parte depois do `?`). */
  scanQueries: string[];
  blocked: string[];
  /** Perfis de resgate por pet (leitura e gravação direta). */
  profiles: Record<string, MockProfile>;
  /** Corpos das chamadas a `set_lost_mode`, e as respostas simuladas (a última se repete). */
  lostBodies: unknown[];
  lostReplies: unknown[];
  /** Corpos dos PATCH em `rescue_profiles`; e erro simulado (mensagem do Postgres) para o próximo PATCH. */
  profilePatches: unknown[];
  profilePatchError: string | null;
  /** Linhas de `pets` devolvidas pelo SELECT (página do pet e edição). */
  petRows: Record<string, unknown>[];
  /** Respostas de `check_tag_for_link` e de `release_tag` (a última se repete) e os corpos recebidos. */
  checkReplies: unknown[];
  checkBodies: unknown[];
  releaseReplies: unknown[];
  releaseBodies: unknown[];
  petDeletes: string[];
  petUpdates: unknown[];
  /** Respostas de `request_tag_replacement` (a última se repete) e os corpos recebidos. */
  replacementReplies: unknown[];
  replacementBodies: unknown[];
  /** `started_at` do vínculo ativo devolvido pela tabela `tag_assignments` (nulo: sem linha). */
  assignmentStart: string | null;
}

export function newTutorState(over: Partial<TutorState> = {}): TutorState {
  return {
    phoneConfirmed: true,
    pets: [
      { id: 'p1', name: 'Paçoca', species: 'dog' },
      { id: 'p2', name: 'Mel', species: 'cat', hasTag: true, tagCode: '2FX8-CN73-F' },
    ],
    activateReplies: [{ ok: true, code: '7K3M-Q9XA-C', pet_id: 'p1', pet_name: 'Paçoca', whatsapp_enabled: true }],
    activateBodies: [],
    petInserts: [],
    uploads: [],
    pendingCodes: [],
    scansRows: [],
    scanQueries: [],
    blocked: [],
    profiles: {},
    lostBodies: [],
    lostReplies: [{ ok: true }],
    profilePatches: [],
    profilePatchError: null,
    petRows: [],
    checkReplies: [{ ok: true, code: '7K3M-Q9XA-C' }],
    checkBodies: [],
    releaseReplies: [{ ok: true, code: '7K3M-Q9XA-C', new_pin: 'K47Q9M' }],
    releaseBodies: [],
    petDeletes: [],
    petUpdates: [],
    replacementReplies: [{ ok: true, request_id: "req-1" }],
    replacementBodies: [],
    assignmentStart: "2026-11-02T21:40:00Z",
    ...over,
  };
}

export async function mockTutorBackend(page: Page, state: TutorState): Promise<TutorState> {
  // O último registro vence: o `abort` genérico primeiro.
  await page.route(/\.supabase\.co\//, (route) => {
    state.blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.abort();
  });
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/rest/v1/rpc/current_user_role', (route) => route.fulfill(json('tutor')));
  await page.route('**/rest/v1/rpc/my_account', (route) =>
    route.fulfill(
      json({
        id: 'u1',
        nome: 'Ana Souza',
        email: 'ana@email.com',
        papel: 'tutor',
        celular: state.phoneConfirmed ? '+5511987654421' : null,
        celular_confirmado_em: state.phoneConfirmed ? '2026-11-22T10:05:00Z' : null,
        celular_pendente: null,
        termos_aceitos_em: '2026-11-22T09:00:00Z',
        termos_versao: '2026-11',
        tem_senha: true,
        provedores: ['email'],
        criado_em: '2026-11-22T09:00:00Z',
      }),
    ),
  );
  await page.route('**/rest/v1/rpc/my_dashboard', (route) =>
    route.fulfill(
      json({
        ok: true,
        pending_activation: null,
        pets: state.pets.map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          photo_path: null,
          lost_mode: p.lostMode === true,
          lost_since: p.lostSince ?? null,
          has_tag: p.hasTag === true,
          tag_code: p.tagCode ?? null,
          tag_status: p.hasTag ? 'assigned' : null,
          scans_month: p.scansMonth ?? 0,
          last_scan: p.lastScan ?? null,
          visible_shown: p.visibleShown ?? 3,
          visible_total: 5,
        })),
      }),
    ),
  );
  await page.route('**/rest/v1/rpc/set_pending_activation', (route) => {
    const body = route.request().postDataJSON() as { p_code: string };
    state.pendingCodes.push(body.p_code);
    return route.fulfill(json({ ok: true }));
  });
  await page.route('**/rest/v1/rpc/activate_tag', (route) => {
    const body = route.request().postDataJSON();
    const reply = state.activateReplies[Math.min(state.activateBodies.length, state.activateReplies.length - 1)];
    state.activateBodies.push(body);
    return route.fulfill(json(reply));
  });
  await page.route('**/storage/v1/object/pet-photos/**', (route) => {
    state.uploads.push(new URL(route.request().url()).pathname);
    return route.fulfill(json({ Key: 'pet-photos/simulado' }));
  });
  await page.route('**/rest/v1/my_scans**', (route) => {
    state.scanQueries.push(new URL(route.request().url()).search);
    return route.fulfill(json(state.scansRows));
  });
  // Tiles do OpenStreetMap: um quadrado liso, sem sair da máquina.
  const tile = makePng();
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.route('**/rest/v1/pets**', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      state.petInserts.push(req.postDataJSON());
      return route.fulfill(json({ id: 'p-novo' }, 201));
    }
    if (req.method() === 'PATCH') {
      state.petUpdates.push(req.postDataJSON());
      return route.fulfill(json([{ id: 'p-novo' }]));
    }
    if (req.method() === 'DELETE') {
      state.petDeletes.push(new URL(req.url()).search);
      return route.fulfill({ status: 204 });
    }
    const wanted = new URL(req.url()).searchParams.get('id')?.replace('eq.', '');
    const rows = wanted === undefined ? state.petRows : state.petRows.filter((row) => row['id'] === wanted);
    const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
    return route.fulfill(json(single ? (rows[0] ?? null) : rows));
  });
  await page.route('**/rest/v1/rpc/set_lost_mode', (route) => {
    const body = route.request().postDataJSON() as { p_pet_id: string; p_on: boolean };
    const reply = state.lostReplies[Math.min(state.lostBodies.length, state.lostReplies.length - 1)];
    state.lostBodies.push(body);
    const profile = state.profiles[body.p_pet_id];
    const pet = state.pets.find((p) => p.id === body.p_pet_id);
    if ((reply as { ok?: boolean }).ok === true) {
      if (pet) {
        pet.lostMode = body.p_on;
        pet.lostSince = body.p_on ? (pet.lostSince ?? new Date().toISOString()) : null;
      }
      if (profile && body.p_on) profile['lost_message'] = (body as Record<string, unknown>)['p_message'];
    }
    return route.fulfill(json(reply));
  });
  await page.route('**/rest/v1/rpc/check_tag_for_link', (route) => {
    const reply = state.checkReplies[Math.min(state.checkBodies.length, state.checkReplies.length - 1)];
    state.checkBodies.push(route.request().postDataJSON());
    return route.fulfill(json(reply));
  });
  await page.route('**/rest/v1/rpc/release_tag', (route) => {
    const reply = state.releaseReplies[Math.min(state.releaseBodies.length, state.releaseReplies.length - 1)];
    state.releaseBodies.push(route.request().postDataJSON());
    return route.fulfill(json(reply));
  });
  await page.route('**/rest/v1/rpc/request_tag_replacement', (route) => {
    const reply = state.replacementReplies[Math.min(state.replacementBodies.length, state.replacementReplies.length - 1)];
    state.replacementBodies.push(route.request().postDataJSON());
    return route.fulfill(json(reply));
  });
  await page.route('**/rest/v1/tag_assignments**', (route) =>
    route.fulfill(json(state.assignmentStart === null ? null : { started_at: state.assignmentStart })),
  );
  await page.route('**/rest/v1/rescue_profiles**', (route) => {
    const req = route.request();
    const petId = new URL(req.url()).searchParams.get('pet_id')?.replace('eq.', '') ?? '';
    const profile = (state.profiles[petId] ??= defaultProfile(petId));
    if (req.method() === 'PATCH') {
      state.profilePatches.push(req.postDataJSON());
      if (state.profilePatchError !== null) {
        const message = state.profilePatchError;
        state.profilePatchError = null;
        return route.fulfill(json({ code: 'P0001', message }, 400));
      }
      Object.assign(profile, req.postDataJSON());
      return route.fulfill(json([profile]));
    }
    const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
    return route.fulfill(json(single ? profile : [profile]));
  });
  return state;
}

export async function persistSession(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)),
    [SESSION_KEY, SESSION] as const,
  );
}
