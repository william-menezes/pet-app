/**
 * Utilitarios HTTP das Edge Functions (contracts/shared-edge.contract.md).
 * Convencao: resultado de negocio em HTTP 200; transporte/configuracao em 4xx/5xx.
 * Nunca escrever em log: codigo, senha, link, e-mail, telefone ou IP em claro.
 */

const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

/** Lista de origens permitidas (ALLOWED_ORIGINS, separada por virgula). Sem permissao de env: vazia (falha fechada). */
export function allowedOriginsFromEnv(): string[] {
  let raw = "";
  try {
    raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  } catch {
    raw = "";
  }
  return raw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

/** Cabecalhos CORS para uma lista explicita de origens. Origem fora da lista: o cabecalho nao e enviado. */
export function corsHeadersFor(
  req: Request,
  allowed: string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function corsHeaders(req: Request): Record<string, string> {
  return corsHeadersFor(req, allowedOriginsFromEnv());
}

/** 204 com CORS se o metodo for OPTIONS; senao null. */
export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Resposta JSON, sempre com CORS e sem cache. */
export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  });
}

/** Limite padrao do corpo (security-hardening.contract.md, secao 5). */
export const DEFAULT_MAX_BODY_BYTES = 4096;

export type BodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: "bad_request" | "payload_too_large" | "unknown_field" };

/**
 * Corpo JSON que seja um objeto simples, com limite de tamanho e lista de chaves conhecidas.
 *  - Content-Length acima do limite, ou mais bytes lidos do que o limite: 413 (a leitura para ao passar do limite).
 *  - Nao e JSON, nao e objeto, ou nao ha corpo: 400 bad_request.
 *  - Chave fora de `allowedKeys` (quando informada): 400 unknown_field. O corpo nunca e repassado adiante inteiro.
 */
export async function readJsonObject(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
  allowedKeys?: readonly string[],
): Promise<BodyResult> {
  const tooLarge: BodyResult = { ok: false, status: 413, error: "payload_too_large" };
  const bad: BodyResult = { ok: false, status: 400, error: "bad_request" };

  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) return tooLarge;
  }
  if (req.body === null) return bad;

  let text: string;
  try {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignora: o corpo ja foi recusado
        }
        return tooLarge;
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.byteLength;
    }
    text = new TextDecoder().decode(all);
  } catch {
    return bad;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return bad;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return bad;
  const body = parsed as Record<string, unknown>;
  if (allowedKeys) {
    for (const key of Object.keys(body)) {
      if (!allowedKeys.includes(key)) return { ok: false, status: 400, error: "unknown_field" };
    }
  }
  return { ok: true, body };
}

/** Resposta de erro de corpo no formato das funcoes desta spec: `{ ok: false, error }`. */
export function bodyErrorResponse(req: Request, r: Extract<BodyResult, { ok: false }>): Response {
  return json(req, { ok: false, error: r.error }, r.status);
}

/**
 * OPTIONS => 204 com CORS; qualquer metodo que nao seja POST => 405 com CORS; POST => null.
 * `body405` permite a funcao antiga (login-guard) manter o formato `{ error }` da 001.
 */
export function guardMethod(
  req: Request,
  body405: Record<string, unknown> = { ok: false, error: "method_not_allowed" },
): Response | null {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, body405, 405);
  return null;
}
