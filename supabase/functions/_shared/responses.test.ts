import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  emptyResponse,
  forbidden,
  internalError,
  jsonResponse,
  methodNotAllowed,
  misconfigured,
  unauthorized,
} from "./responses.ts";

Deno.test("unauthorized: 401, corpo vazio, sem cache", async () => {
  const r = unauthorized();
  assertEquals(r.status, 401);
  assertEquals(await r.text(), "");
  assertEquals(r.headers.get("cache-control"), "no-store");
  assertEquals(r.headers.get("content-type"), null);
});

Deno.test("emptyResponse e jsonResponse: sem cache e sem CORS (chamada de servidor para servidor)", async () => {
  const e = emptyResponse(204);
  assertEquals(e.status, 204);
  assertEquals(e.headers.get("cache-control"), "no-store");
  assertEquals(e.headers.get("access-control-allow-origin"), null);

  const j = jsonResponse({ ok: true }, 200, { "X-Teste": "1" });
  assertEquals(j.status, 200);
  assertEquals(j.headers.get("content-type"), "application/json");
  assertEquals(j.headers.get("cache-control"), "no-store");
  assertEquals(j.headers.get("x-teste"), "1");
  assertEquals(j.headers.get("access-control-allow-origin"), null);
  assertEquals(await j.json(), { ok: true });
});

Deno.test("erros padrao: corpo fixo, sem detalhe", async () => {
  assertEquals(forbidden().status, 403);
  assertEquals(await forbidden().json(), { ok: false, error: "forbidden" });
  assertEquals(misconfigured().status, 500);
  assertEquals(await misconfigured().json(), { ok: false, error: "misconfigured" });
  assertEquals(internalError().status, 500);
  assertEquals(await internalError().json(), { ok: false, error: "internal_error" });
  const m = methodNotAllowed();
  assertEquals(m.status, 405);
  assertEquals(m.headers.get("allow"), "POST");
  assertEquals(await m.json(), { ok: false, error: "method_not_allowed" });
});
