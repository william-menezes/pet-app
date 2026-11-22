import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeadersFor, handleOptions, readJsonObject } from "./http.ts";

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

Deno.test("readJsonObject: objeto ok; array, string e lixo viram null", async () => {
  const mk = (b: string) => new Request("http://x/fn", { method: "POST", body: b });
  assertEquals(await readJsonObject(mk('{"a":1}')), { a: 1 });
  assertEquals(await readJsonObject(mk("[1]")), null);
  assertEquals(await readJsonObject(mk('"x"')), null);
  assertEquals(await readJsonObject(mk("null")), null);
  assertEquals(await readJsonObject(mk("{nao json")), null);
});
