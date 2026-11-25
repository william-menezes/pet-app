import type { Page } from '@playwright/test';

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
}

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
  scansRows: unknown[];
  blocked: string[];
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
    blocked: [],
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
          lost_mode: false,
          lost_since: null,
          has_tag: p.hasTag === true,
          tag_code: p.tagCode ?? null,
          tag_status: p.hasTag ? 'assigned' : null,
          scans_month: 0,
          last_scan: null,
          visible_shown: 3,
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
  await page.route('**/rest/v1/pets**', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      state.petInserts.push(req.postDataJSON());
      return route.fulfill(json({ id: 'p-novo' }, 201));
    }
    if (req.method() === 'PATCH') return route.fulfill(json([{ id: 'p-novo' }]));
    return route.fulfill(json([]));
  });
  return state;
}

export async function persistSession(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)),
    [SESSION_KEY, SESSION] as const,
  );
}
