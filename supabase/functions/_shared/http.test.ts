import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bodyErrorResponse, corsHeadersFor, guardMethod, handleOptions, readJsonObject, withCors } from "./http.ts";

const ORIGIN = "http://localhost:4200";

Deno.test("CORS: origem permitida recebe Allow-Origin e Vary", () => {
  const req = new Request("http://x/fn", { headers: { origin: ORIGIN } });
  const h = corsHeadersFor(req, [ORIGIN]);
  assertEquals(h["Access-Control-Allow-Origin"], ORIGIN);
  assertEquals(h["Vary"], "Origin");
  assertEquals(h["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

Deno.test("CORS: origem fora da lista nao recebe Allow-Origin", () => {
  const req = new Request("http://x/fn", { headers: { origin: "https://evil.example" } });
  assertEquals("Access-Control-Allow-Origin" in corsHeadersFor(req, [ORIGIN]), false);
});

Deno.test("CORS: lista vazia (falha fechada) nao envia Allow-Origin", () => {
  const req = new Request("http://x/fn", { headers: { origin: ORIGIN } });
  assertEquals("Access-Control-Allow-Origin" in corsHeadersFor(req, []), false);
});

Deno.test("handleOptions: POST devolve null", () => {
  assertEquals(handleOptions(new Request("http://x/fn", { method: "POST", body: "{}" })), null);
});

Deno.test("handleOptions: OPTIONS devolve 204", () => {
  const res = handleOptions(new Request("http://x/fn", { method: "OPTIONS" }));
  assertEquals(res?.status, 204);
});

const mk = (b: string, headers: Record<string, string> = {}) =>
  new Request("http://x/fn", { method: "POST", body: b, headers });

Deno.test("readJsonObject: objeto ok; array, string, null e lixo viram 400 bad_request", async () => {
  assertEquals(await readJsonObject(mk('{"a":1}')), { ok: true, body: { a: 1 } });
  for (const bad of ["[1]", '"x"', "null", "{nao json", ""]) {
    assertEquals(await readJsonObject(mk(bad)), { ok: false, status: 400, error: "bad_request" });
  }
});

Deno.test("readJsonObject: pedido sem corpo => 400 bad_request", async () => {
  const r = await readJsonObject(new Request("http://x/fn", { method: "POST" }));
  assertEquals(r, { ok: false, status: 400, error: "bad_request" });
});

Deno.test("readJsonObject: corpo de 5 KB => 413 pelo Content-Length, sem ler o corpo", async () => {
  const body = JSON.stringify({ a: "x".repeat(5 * 1024) });
  const r = await readJsonObject(mk(body, { "content-length": String(new TextEncoder().encode(body).length) }));
  assertEquals(r, { ok: false, status: 413, error: "payload_too_large" });
});

Deno.test("readJsonObject: Content-Length mente (diz 10) e o corpo lido passa de 4 KB => 413", async () => {
  const body = JSON.stringify({ a: "x".repeat(5 * 1024) });
  const r = await readJsonObject(mk(body, { "content-length": "10" }));
  assertEquals(r, { ok: false, status: 413, error: "payload_too_large" });
});

Deno.test("readJsonObject: corpo em pedacos (sem Content-Length) que passa do limite => 413 e a leitura para", async () => {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      controller.enqueue(new TextEncoder().encode("x".repeat(1000)));
      if (pulled > 50) controller.close();
    },
  });
  const req = new Request("http://x/fn", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  const r = await readJsonObject(req);
  assertEquals(r, { ok: false, status: 413, error: "payload_too_large" });
  assertEquals(pulled < 20, true);
});

Deno.test("readJsonObject: o limite e parametro (2 KB)", async () => {
  const body = JSON.stringify({ a: "x".repeat(3000) });
  assertEquals((await readJsonObject(mk(body), 2048)).ok, false);
  assertEquals((await readJsonObject(mk(body), 4096)).ok, true);
});

Deno.test("readJsonObject: exatamente no limite passa; um byte a mais nao", async () => {
  const exact = '{"a":"' + "x".repeat(4096 - 8) + '"}';
  assertEquals(new TextEncoder().encode(exact).length, 4096);
  assertEquals((await readJsonObject(mk(exact))).ok, true);
  assertEquals((await readJsonObject(mk(exact + " "))).ok, false);
});

Deno.test("readJsonObject: chave desconhecida => 400 unknown_field; chaves conhecidas passam", async () => {
  const keys = ["a", "b"] as const;
  assertEquals(await readJsonObject(mk('{"a":1,"b":2}'), 4096, keys), { ok: true, body: { a: 1, b: 2 } });
  assertEquals(await readJsonObject(mk('{"a":1,"intruso":2}'), 4096, keys), {
    ok: false,
    status: 400,
    error: "unknown_field",
  });
  // Sem lista, nenhuma chave e recusada.
  assertEquals((await readJsonObject(mk('{"qualquer":1}'))).ok, true);
});

Deno.test("bodyErrorResponse: devolve { ok: false, error } com o status do erro", async () => {
  const req = new Request("http://x/fn", { method: "POST" });
  const r413 = bodyErrorResponse(req, { ok: false, status: 413, error: "payload_too_large" });
  assertEquals(r413.status, 413);
  assertEquals(await r413.json(), { ok: false, error: "payload_too_large" });
  const r400 = bodyErrorResponse(req, { ok: false, status: 400, error: "unknown_field" });
  assertEquals(r400.status, 400);
  assertEquals(await r400.json(), { ok: false, error: "unknown_field" });
});

Deno.test("guardMethod: POST passa (null); OPTIONS => 204", () => {
  assertEquals(guardMethod(new Request("http://x/fn", { method: "POST", body: "{}" })), null);
  assertEquals(guardMethod(new Request("http://x/fn", { method: "OPTIONS" }))?.status, 204);
});

Deno.test("guardMethod: GET, PUT, PATCH e DELETE => 405 com os cabecalhos de CORS do contrato", async () => {
  for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
    const res = guardMethod(new Request("http://x/fn", { method }));
    assertEquals(res?.status, 405, method);
    assertEquals(res?.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS", method);
    assertEquals(
      res?.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type",
      method,
    );
    assertEquals(await res?.json(), { ok: false, error: "method_not_allowed" }, method);
  }
});

Deno.test("guardMethod: o formato do 405 pode ser o da 001 ({ error })", async () => {
  const res = guardMethod(new Request("http://x/fn", { method: "GET" }), { error: "method_not_allowed" });
  assertEquals(res?.status, 405);
  assertEquals(await res?.json(), { error: "method_not_allowed" });
});

Deno.test("corsHeadersFor: Expose so vai com origem permitida; sem o parametro nao existe", () => {
  const ok = new Request("http://x/fn", { headers: { origin: "https://app.test" } });
  const bad = new Request("http://x/fn", { headers: { origin: "https://evil.test" } });
  assertEquals(corsHeadersFor(ok, ["https://app.test"], ["X-A", "X-B"])["Access-Control-Expose-Headers"], "X-A, X-B");
  assertEquals(corsHeadersFor(ok, ["https://app.test"])["Access-Control-Expose-Headers"], undefined);
  assertEquals(corsHeadersFor(bad, ["https://app.test"], ["X-A"])["Access-Control-Expose-Headers"], undefined);
});

Deno.test("withCors: acrescenta CORS sem mexer em status, corpo nem nos cabecalhos da resposta; origem fora da lista nao recebe Allow-Origin", async () => {
  const res = new Response("zip", { status: 200, headers: { "X-Batch-Id": "lote-9", "Cache-Control": "no-store" } });
  const ok = withCors(new Request("http://x/fn", { headers: { origin: "https://app.test" } }), res, ["https://app.test"], ["X-Batch-Id"]);
  assertEquals(ok.status, 200);
  assertEquals(await ok.text(), "zip");
  assertEquals(ok.headers.get("x-batch-id"), "lote-9");
  assertEquals(ok.headers.get("cache-control"), "no-store");
  assertEquals(ok.headers.get("access-control-allow-origin"), "https://app.test");
  assertEquals(ok.headers.get("access-control-expose-headers"), "X-Batch-Id");
  const bad = withCors(new Request("http://x/fn", { headers: { origin: "https://evil.test" } }), new Response(null, { status: 401 }), ["https://app.test"]);
  assertEquals(bad.status, 401);
  assertEquals(bad.headers.get("access-control-allow-origin"), null);
  assertEquals(bad.headers.get("vary"), "Origin");
});
