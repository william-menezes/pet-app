/**
 * Respostas das Edge Functions de tag (spec 003). Estas funcoes sao chamadas de servidor para servidor (o servidor
 * SSR do app) ou por um admin autenticado, nunca direto pelo navegador da pagina publica: por isso aqui nao ha CORS.
 *
 * Regras (contracts/public-page.contract.md e security-hardening.contract.md):
 *  - sem a chave: 401 com corpo VAZIO (nada que ajude quem testa chaves);
 *  - toda resposta sai com `Cache-Control: no-store`;
 *  - nada de PIN, chave, token, IP ou telefone em corpo de erro.
 */

const BASE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Resposta JSON sem cache. */
export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...BASE_HEADERS, ...extra },
  });
}

/** Resposta sem corpo. */
export function emptyResponse(status: number, extra: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...extra } });
}

/** 401 com corpo vazio: chamada sem a chave do servidor, ou com chave errada. */
export function unauthorized(): Response {
  return emptyResponse(401);
}

/** 403: autenticado, mas sem papel de admin. Corpo fixo, sem detalhe. */
export function forbidden(): Response {
  return jsonResponse({ ok: false, error: "forbidden" }, 403);
}

/** 500 de configuracao (segredo ausente ou fraco). Diz so que a funcao nao esta configurada, nunca qual valor. */
export function misconfigured(): Response {
  return jsonResponse({ ok: false, error: "misconfigured" }, 500);
}

/** 500 interno generico. */
export function internalError(): Response {
  return jsonResponse({ ok: false, error: "internal_error" }, 500);
}

/** 405 para metodo diferente de POST. */
export function methodNotAllowed(): Response {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
}
