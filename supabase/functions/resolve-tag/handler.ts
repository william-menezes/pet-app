/**
 * Orquestracao da Edge Function `resolve-tag` (spec 003, T027; contracts/public-page.contract.md). Separada do
 * `Deno.serve` para ser testavel com falsos (padrao da 004).
 *
 * Principio I (Rescue-First): o servidor SSR do app NUNCA recebe erro tecnico desta funcao. Autorizada a chamada, a
 * resposta e sempre 200 com um destes corpos:
 *   {"state":"assigned","profile":{...}}   so o que o tutor liberou; foto como URL assinada de 3600 s
 *   {"state":"available","code":"XXXX-XXXX-X"}
 *   {"state":"not_found"}                  codigo invalido, inexistente, bloqueado ou anulado: MESMO corpo, mesmos cabecalhos
 *   {"state":"rate_limited"}               limite por ip_hash, e tambem a falha da RPC ou da entrada (a pagina cai na contingencia)
 * Sem a chave `x-faro-ssr-key`: 401 com corpo vazio. A resposta e montada CAMPO A CAMPO a partir da RPC (nunca repassa o
 * jsonb): campo que nao for do formato esperado some.
 *
 * Anti-enumeracao: o digito verificador e conferido ANTES do banco; os tres estados que nao sao o resgate esperam ate um
 * piso de 150 ms (security-hardening.contract.md secao 1), para o tempo nao distinguir um estado do outro. O piso vale
 * tambem para o digito invalido e para a falha da RPC.
 *
 * Nada de PIN, chave, IP ou dado do tutor em log: esta funcao nao escreve log.
 */
import { requireSsrKey } from "../_shared/auth.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/responses.ts";
import { format, isValid, normalize } from "../_shared/tag-code.ts";

/** Piso de tempo de resposta dos estados que nao sao o resgate. */
export const RESOLVE_FLOOR_MS = 150;
/** Corpo maximo aceito. */
export const RESOLVE_MAX_BODY = 2048;
/** Validade da URL assinada da foto. */
export const PHOTO_URL_TTL_SECONDS = 3600;

export interface ResolveDeps {
  /** Chaves aceitas (`() => ssrKeysFromEnv()`); se lancar MisconfiguredError a resposta e 500. */
  keys(): readonly string[];
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  /** URL assinada de 3600 s para o caminho no bucket `pet-photos`, ou null. Pode lancar. */
  signPhoto(path: string): Promise<string | null>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

type Rec = Record<string, unknown>;

const NOT_FOUND = { state: "not_found" } as const;
const RATE_LIMITED = { state: "rate_limited" } as const;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

async function buildRescue(profile: unknown, code: string, deps: ResolveDeps): Promise<Rec> {
  if (!isRec(profile) || !isRec(profile.pet) || !nonEmpty(profile.pet.name)) return { ...RATE_LIMITED };

  const pet: Rec = { name: profile.pet.name };
  if (nonEmpty(profile.pet.photo_path)) {
    try {
      const url = await deps.signPhoto(profile.pet.photo_path);
      if (nonEmpty(url)) pet.photo_url = url;
    } catch {
      // So a foto falha: o perfil sai sem `photo_url` (a pagina mostra o focinho).
    }
  }

  const out: Rec = { code: format(code), pet };
  if (Array.isArray(profile.temperament) && profile.temperament.length > 0 && profile.temperament.every(nonEmpty)) {
    out.temperament = [...profile.temperament];
  }
  if (nonEmpty(profile.care_notes)) out.care_notes = profile.care_notes;
  if (nonEmpty(profile.tutor_first_name)) out.tutor_first_name = profile.tutor_first_name;
  if (nonEmpty(profile.whatsapp_url) && profile.whatsapp_url.startsWith("https://wa.me/")) {
    out.whatsapp_url = profile.whatsapp_url;
  }
  if (nonEmpty(profile.phone_display)) out.phone_display = profile.phone_display;
  if (isRec(profile.lost)) {
    const lost: Rec = {};
    if (nonEmpty(profile.lost.since)) lost.since = profile.lost.since;
    if (profile.lost.reward === true) lost.reward = true;
    if (nonEmpty(profile.lost.message)) lost.message = profile.lost.message;
    out.lost = lost;
  }
  return { state: "assigned", profile: out };
}

async function resolve(req: Request, deps: ResolveDeps): Promise<Rec> {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > RESOLVE_MAX_BODY) return { ...NOT_FOUND };
    body = JSON.parse(text);
  } catch {
    return { ...NOT_FOUND };
  }
  if (!isRec(body) || typeof body.code !== "string" || body.code.length > 64) return { ...NOT_FOUND };

  // Digito verificador ANTES do banco: codigo invalido nao toca o banco.
  const code = normalize(body.code);
  if (!isValid(code)) return { ...NOT_FOUND };

  const ipHash = typeof body.ip_hash === "string" && body.ip_hash.length > 0 && body.ip_hash.length <= 128
    ? body.ip_hash
    : "unknown";

  let res: { data: unknown; error: unknown };
  try {
    res = await deps.rpc("resolve_tag", { p_code: code, p_ip_hash: ipHash });
  } catch {
    return { ...RATE_LIMITED };
  }
  if (res.error || !isRec(res.data)) return { ...RATE_LIMITED };

  switch (res.data.state) {
    case "not_found":
      return { ...NOT_FOUND };
    case "rate_limited":
      return { ...RATE_LIMITED };
    case "available":
      return { state: "available", code: format(code) };
    case "assigned":
      return await buildRescue(res.data.profile, code, deps);
    default:
      return { ...RATE_LIMITED };
  }
}

/** Espera ate `RESOLVE_FLOOR_MS` desde `start`. */
async function floor(deps: ResolveDeps, start: number): Promise<void> {
  const rest = RESOLVE_FLOOR_MS - (deps.now() - start);
  if (rest > 0) await deps.sleep(rest);
}

export function createResolveHandler(deps: ResolveDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const denied = await requireSsrKey(req, () => deps.keys());
    if (denied) return denied;
    if (req.method !== "POST") return methodNotAllowed();

    const start = deps.now();
    let result: Rec;
    try {
      result = await resolve(req, deps);
    } catch {
      result = { ...RATE_LIMITED };
    }
    // O resgate responde assim que tiver o perfil; os outros tres estados esperam o piso.
    if (result.state !== "assigned") await floor(deps, start);
    return jsonResponse(result);
  };
}
