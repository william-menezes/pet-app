/**
 * Apoio do E2E real da spec 003 (tag com QR Code). So fala com o stack LOCAL (o global-setup recusa outro host).
 *
 * Codigos e PINs: o `global-setup` cria UM lote pelo mesmo caminho do admin (Edge Function `admin-create-batch`) e grava
 * os pares codigo/PIN em `test-results-real/pool.json` (pasta ignorada pelo git). Cada teste que muda uma tag pega um
 * par novo com `takeTag()`: assim a segunda tentativa de um teste (retries) nunca encontra a tag ja vinculada, e o
 * seed (`e2e/fixtures/seed-codes.json`) fica so para leitura. Os PINs de desenvolvimento do seed so entram aqui nos
 * testes que conferem o proprio seed. Nada disto e PIN real: o stack e descartavel e o lote e sintetico.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { adminCreateUser, apiSignIn, confirmPhoneAsService, rest, SEED, stack, uniqueEmail, uniquePhoneDigits } from './stack';

export const POOL_FILE = 'test-results-real/pool.json';
/** Chave do servidor do app: sorteada pelo e2e-prepare.sh (CI) ou definida por quem roda localmente. */
export const SSR_KEY = process.env['E2E_SSR_KEY'] ?? '';

export interface PoolTag {
  /** forma canonica (9 caracteres) */
  code: string;
  /** forma de exibicao XXXX-XXXX-X */
  display: string;
  pin: string;
}
interface Pool {
  batchId: string;
  tags: PoolTag[];
  next: number;
}

const canon = (display: string) => display.replace(/-/g, '');

/** Le o `pins.csv` de um ZIP "store" (sem compressao), como o que a Edge Function monta. */
export function readStoredZipEntry(zip: Buffer, name: string): string {
  let off = 0;
  while (off + 30 <= zip.length && zip.readUInt32LE(off) === 0x04034b50) {
    const size = zip.readUInt32LE(off + 18);
    const nameLen = zip.readUInt16LE(off + 26);
    const extraLen = zip.readUInt16LE(off + 28);
    const entryName = zip.subarray(off + 30, off + 30 + nameLen).toString('utf8');
    const start = off + 30 + nameLen + extraLen;
    if (entryName === name) return zip.subarray(start, start + size).toString('utf8');
    off = start + size;
  }
  throw new Error(`entrada ${name} nao encontrada no ZIP`);
}

export function parsePinsCsv(csv: string): PoolTag[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== 'code,pin') throw new Error('cabecalho inesperado em pins.csv');
  return lines.slice(1).map((l) => {
    const [display, pin] = l.split(',');
    return { display, code: canon(display), pin };
  });
}

export async function adminSession() {
  const r = await apiSignIn(SEED.admin.email, SEED.password);
  if (!r.session) throw new Error(`login do admin do seed falhou (HTTP ${r.status})`);
  return r.session;
}

/** Cria um lote como o admin e devolve o id e os pares codigo/PIN (so em memoria). */
export async function createBatchViaFunction(
  quantity: number,
  token?: string,
): Promise<{ status: number; batchId: string | null; tags: PoolTag[]; headers: Headers }> {
  const t = token ?? (await adminSession()).access_token;
  const res = await fetch(`${stack.url}/functions/v1/admin-create-batch`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, notes: 'e2e' }),
  });
  if (res.status !== 200) return { status: res.status, batchId: null, tags: [], headers: res.headers };
  const zip = Buffer.from(await res.arrayBuffer());
  return {
    status: 200,
    batchId: res.headers.get('x-batch-id'),
    tags: parsePinsCsv(readStoredZipEntry(zip, 'pins.csv')),
    headers: res.headers,
  };
}

/**
 * O pool sai em lotes pequenos: `admin_insert_batch` gasta ~0,2 s de bcrypt por codigo e o PostgREST cancela a chamada em 8 s
 * (`authenticator.statement_timeout`), entao um lote de ~40 ou mais volta 500 (DEF-003-01, provado em `admin.spec.ts`).
 */
export async function createPool(total: number, perBatch = 24): Promise<void> {
  const tags: PoolTag[] = [];
  let batchId = '';
  for (let left = total; left > 0; left -= perBatch) {
    const b = await createBatchViaFunction(Math.min(perBatch, left));
    if (b.status !== 200 || !b.batchId) throw new Error(`nao foi possivel criar o lote do E2E (HTTP ${b.status})`);
    batchId = b.batchId;
    tags.push(...b.tags);
  }
  mkdirSync(dirname(POOL_FILE), { recursive: true });
  writeFileSync(POOL_FILE, JSON.stringify({ batchId, tags, next: 0 } satisfies Pool));
}

/** Proximo par codigo/PIN que ninguem usou (um processo so: `workers: 1`). */
export function takeTag(): PoolTag {
  if (!existsSync(POOL_FILE)) throw new Error('pool de tags ausente (o global-setup cria)');
  const pool = JSON.parse(readFileSync(POOL_FILE, 'utf8')) as Pool;
  const tag = pool.tags[pool.next];
  if (!tag) throw new Error('pool de tags esgotado: aumente a quantidade no global-setup');
  pool.next += 1;
  writeFileSync(POOL_FILE, JSON.stringify(pool));
  return tag;
}

export interface Tutor {
  id: string;
  email: string;
  password: string;
  phoneDigits: string;
  token: string;
}

/** Conta nova com celular confirmado (ou nao), ja com sessao de API. */
export async function newTutor(opts: { phoneConfirmed?: boolean } = {}): Promise<Tutor> {
  const u = await adminCreateUser({ email: uniqueEmail('t3') });
  const phoneDigits = uniquePhoneDigits();
  if (opts.phoneConfirmed ?? true) await confirmPhoneAsService(u.id, phoneDigits);
  const s = await apiSignIn(u.email, u.password);
  if (!s.session) throw new Error('login do tutor de teste falhou');
  return { ...u, phoneDigits, token: s.session.access_token };
}

export async function seedTutor(which: 'tutorA' | 'tutorB'): Promise<Tutor> {
  const r = await apiSignIn(SEED[which].email, SEED.password);
  if (!r.session) throw new Error(`login do seed ${which} falhou`);
  return { id: SEED[which].id, email: SEED[which].email, password: SEED.password, phoneDigits: '', token: r.session.access_token };
}

export async function createPet(t: Tutor, name = 'Bolota', species: 'dog' | 'cat' = 'dog'): Promise<string> {
  const r = await rest('pets?select=id', {
    token: t.token,
    method: 'POST',
    body: { tutor_id: t.id, name, species },
    headers: { Prefer: 'return=representation' },
  });
  if (r.status >= 300) throw new Error(`createPet: HTTP ${r.status} ${JSON.stringify(r.body)}`);
  return r.body[0].id as string;
}

/** Chamada de RPC com o token do tutor. */
export function rpc(t: Tutor | null, fn: string, body: Record<string, unknown> = {}) {
  return rest(`rpc/${fn}`, { token: t?.token, method: 'POST', body });
}

/** Ativa uma tag pela RPC (preparacao de estado; o fluxo pela tela e testado a parte). */
export async function activateViaApi(t: Tutor, tag: PoolTag, petId: string, opts: { whatsapp?: boolean } = {}) {
  const r = await rpc(t, 'activate_tag', {
    p_code: tag.code,
    p_pin: tag.pin,
    p_pet_id: petId,
    p_replace: false,
    p_enable_whatsapp: opts.whatsapp ?? false,
  });
  if (!r.body?.ok) throw new Error(`activateViaApi falhou: ${JSON.stringify(r.body)}`);
  return r.body;
}

/** Chama `resolve-tag` como o servidor do app (chave do servidor); devolve o corpo ja lido. */
export async function resolveAsServer(code: string, ipHash = 'e2e-ip-' + Math.random().toString(36).slice(2)) {
  const t0 = Date.now();
  const res = await fetch(`${stack.url}/functions/v1/resolve-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-faro-ssr-key': SSR_KEY },
    body: JSON.stringify({ code, ip_hash: ipHash }),
  });
  const text = await res.text();
  return { status: res.status, text, ms: Date.now() - t0, headers: res.headers };
}
