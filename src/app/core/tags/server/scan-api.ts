/**
 * scan-api.ts — T025 e parte de T104 (spec 003; `public-page.contract.md`, `security-hardening.contract.md` §3)
 *
 * Lógica de `POST /api/scan` e `POST /api/scan/location`, SEM Express: funções puras (com `fetch` injetado)
 * para testar sem o servidor e para poder ir para `api/*.ts` da Vercel sem reescrever, se a conferência de
 * hospedagem (T024A) reprovar a rota própria do Express.
 *
 * Regras:
 *  - mesma origem: `Sec-Fetch-Site: same-origin`, ou, sem ele, `Origin` com o mesmo host; senão `403`;
 *  - só JSON (`415`), até 2 KB (`413`), só as chaves do contrato (`400` com chave desconhecida ou tipo errado);
 *  - o IP vem só dos cabeçalhos da Vercel (`client-ip.ts`); só o HMAC dele segue adiante;
 *  - a geolocalização por IP vem dos cabeçalhos `x-vercel-ip-*` (ausentes: o scan é gravado sem posição);
 *  - falha, variável ausente, código inválido ou erro do upstream: `200` com `{ owner: false }` (ou
 *    `{ updated: false }`). A página da tag nunca quebra por causa do registro de scan.
 * Chave e segredo vêm de variável de ambiente do servidor e nunca voltam na resposta.
 */
import { isValid, normalize } from '../../tag-code/tag-code';
import { clientIp, ipHash, type HeaderReader } from './client-ip';
import type { ServerEnv } from './server-env';

export type ScanRoute = 'scan' | 'location';

/** Corpo máximo aceito, em bytes. */
export const SCAN_API_MAX_BODY = 2048;

export interface ScanApiRequest {
  route: ScanRoute;
  headers: HeaderReader;
  /** Corpo cru; `'too_large'` quando passou do limite (o servidor para de ler). */
  body: Uint8Array | 'too_large' | null;
}

export interface ScanApiResult {
  status: number;
  /** Ausente: resposta de corpo vazio. */
  body?: Record<string, unknown>;
}

export interface ScanApiDeps {
  env: ServerEnv;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value);

const SCAN_KEYS = ['code'];
const LOCATION_KEYS = ['scan_token', 'lat', 'lng', 'accuracy_m'];

const empty = (status: number): ScanApiResult => ({ status });

function neutral(route: ScanRoute): ScanApiResult {
  return { status: 200, body: route === 'scan' ? { owner: false } : { updated: false } };
}

/** Mesma origem: `Sec-Fetch-Site`, ou `Origin` com o mesmo host que `Host`. */
export function isSameOrigin(headers: HeaderReader): boolean {
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = headers.get('origin');
  const host = headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isJson(headers: HeaderReader): boolean {
  const type = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return type === 'application/json';
}

function parseBody(raw: Uint8Array): Rec | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    return isRec(value) ? value : null;
  } catch {
    return null;
  }
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Valida as chaves e os tipos de cada rota. `null` = corpo inválido (`400`). */
function validate(route: ScanRoute, body: Rec): Rec | null {
  const allowed = route === 'scan' ? SCAN_KEYS : LOCATION_KEYS;
  if (Object.keys(body).some((key) => !allowed.includes(key))) return null;
  if (route === 'scan') {
    const code = body['code'];
    return typeof code === 'string' && code.length > 0 && code.length <= 64 ? { code } : null;
  }
  const token = body['scan_token'];
  const lat = body['lat'];
  const lng = body['lng'];
  const accuracy = body['accuracy_m'];
  if (typeof token !== 'string' || token.length === 0 || token.length > 128) return null;
  if (!finite(lat) || lat < -90 || lat > 90 || !finite(lng) || lng < -180 || lng > 180) return null;
  if (!finite(accuracy) || accuracy < 0 || accuracy > 1_000_000) return null;
  return { scan_token: token, lat, lng, accuracy_m: accuracy };
}

/** Posição aproximada por IP, pelos cabeçalhos `x-vercel-ip-*`. Ausente ou fora do formato: `undefined`. */
export function geoFromHeaders(headers: HeaderReader): Rec | undefined {
  const lat = Number(headers.get('x-vercel-ip-latitude'));
  const lng = Number(headers.get('x-vercel-ip-longitude'));
  const decode = (value: string | null | undefined): string | undefined => {
    if (!value) return undefined;
    try {
      const text = decodeURIComponent(value).trim();
      return text !== '' && text.length <= 80 ? text : undefined;
    } catch {
      return undefined;
    }
  };
  const hasPosition =
    headers.get('x-vercel-ip-latitude') && headers.get('x-vercel-ip-longitude') &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const city = decode(headers.get('x-vercel-ip-city'));
  const region = decode(headers.get('x-vercel-ip-country-region'));
  if (!hasPosition && city === undefined && region === undefined) return undefined;
  return {
    ...(hasPosition ? { lat, lng } : {}),
    ...(city !== undefined ? { city } : {}),
    ...(region !== undefined ? { region } : {}),
  };
}

/** `Authorization: Bearer <jwt>` com cara de JWT, ou `undefined`. */
export function bearerToken(headers: HeaderReader): string | undefined {
  const match = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/.exec(headers.get('authorization') ?? '');
  return match !== null && match[1].length <= 4096 ? match[1] : undefined;
}

async function callRegisterScan(payload: Rec, env: ServerEnv, fetchFn: typeof fetch, timeoutMs: number): Promise<Rec | null> {
  if (env.functionsUrl === null || env.ssrKey === null) return null;
  try {
    const response = await fetchFn(`${env.functionsUrl}/register-scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-faro-ssr-key': env.ssrKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 200) return null;
    const data: unknown = await response.json();
    return isRec(data) ? data : null;
  } catch {
    return null;
  }
}

export async function handleScanApi(request: ScanApiRequest, deps: ScanApiDeps): Promise<ScanApiResult> {
  const { route, headers, body: raw } = request;
  const { env, fetchFn = fetch, timeoutMs = 3000 } = deps;

  if (!isSameOrigin(headers)) return empty(403);
  if (!isJson(headers)) return empty(415);
  if (raw === 'too_large' || (raw !== null && raw.length > SCAN_API_MAX_BODY)) return empty(413);
  if (raw === null) return empty(400);
  const parsed = parseBody(raw);
  const input = parsed === null ? null : validate(route, parsed);
  if (input === null) return empty(400);

  if (env.ipHashSecret === null) return neutral(route);

  if (route === 'scan') {
    const code = normalize(String(input['code']));
    if (!isValid(code)) return neutral(route);
    const jwt = bearerToken(headers);
    const geo = geoFromHeaders(headers);
    const data = await callRegisterScan(
      {
        action: 'scan',
        code,
        ip_hash: ipHash(env.ipHashSecret, clientIp(headers)),
        ...(geo !== undefined ? { geo } : {}),
        ...(jwt !== undefined ? { user_jwt: jwt } : {}),
      },
      env,
      fetchFn,
      timeoutMs,
    );
    if (data === null) return neutral(route);
    const token = data['scan_token'];
    return {
      status: 200,
      body: {
        owner: data['owner'] === true,
        ...(data['owner'] !== true && typeof token === 'string' && token !== '' ? { scan_token: token } : {}),
      },
    };
  }

  const data = await callRegisterScan({ action: 'location', ...input }, env, fetchFn, timeoutMs);
  return { status: 200, body: { updated: data?.['updated'] === true } };
}
