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

/** Corpo JSON que seja um objeto simples; qualquer outra coisa devolve null (o chamador responde 400 bad_request). */
export async function readJsonObject(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
