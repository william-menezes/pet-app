import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCaller } from "./caller.ts";

// JWTs de mentira (so a forma importa aqui; a validacao real e do verificador, que e falso nos testes).
const seg = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (o: object) => `${seg({ alg: "HS256" })}.${seg(o)}.assinatura-falsa`;
const USER_JWT = jwt({ sub: "u1", role: "authenticated" });
const ANON_JWT = jwt({ role: "anon" });

function req(authorization?: string): Request {
  const headers = new Headers({ apikey: "sb_publishable_fake0123456789" });
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://x.test/", { method: "POST", headers });
}

/** Verificador falso: conta chamadas; so aceita USER_JWT. */
function fakeVerifier() {
  const calls: string[] = [];
  const verify = (token: string): Promise<{ id: string } | null> => {
    calls.push(token);
    return Promise.resolve(token === USER_JWT ? { id: "u1" } : null);
  };
  return { calls, verify };
}

Deno.test("sem Authorization: null, sem consultar o Auth", async () => {
  const f = fakeVerifier();
  assertEquals(await resolveCaller(req(), f.verify), null);
  assertEquals(f.calls.length, 0);
});

Deno.test("chave publishable no Authorization (nao e JWT): null, sem consultar o Auth", async () => {
  const f = fakeVerifier();
  assertEquals(await resolveCaller(req("Bearer sb_publishable_fake0123456789"), f.verify), null);
  assertEquals(f.calls.length, 0);
});

Deno.test("lixo e esquemas errados: null, sem consultar o Auth", async () => {
  const f = fakeVerifier();
  for (const h of ["Bearer ", "Bearer", "Basic abc.def.ghi", "Bearer a.b", "Bearer a.b.c.d", "Bearer a b.c.d", "abc.def.ghi"]) {
    assertEquals(await resolveCaller(req(h), f.verify), null, h);
  }
  assertEquals(f.calls.length, 0);
});

Deno.test("chave anon legada (JWT sem usuario): vai ao Auth, que recusa => null", async () => {
  const f = fakeVerifier();
  assertEquals(await resolveCaller(req(`Bearer ${ANON_JWT}`), f.verify), null);
  assertEquals(f.calls.length, 1);
});

Deno.test("JWT invalido (assinatura ruim): o Auth recusa => null", async () => {
  const f = fakeVerifier();
  assertEquals(await resolveCaller(req(`Bearer ${jwt({ sub: "u1", role: "authenticated" })}x`), f.verify), null);
});

Deno.test("JWT de usuario valido: devolve o usuario do verificador (esquema sem diferenciar maiusculas)", async () => {
  const f = fakeVerifier();
  assertEquals(await resolveCaller(req(`bearer ${USER_JWT}`), f.verify), { id: "u1" });
  assertEquals(f.calls, [USER_JWT]);
});

Deno.test("verificador que lanca: null (chamador anonimo), nunca excecao", async () => {
  const boom = (): Promise<never> => Promise.reject(new Error("rede fora"));
  assertEquals(await resolveCaller(req(`Bearer ${USER_JWT}`), boom), null);
});
