import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AdminDeps,
  bearerToken,
  MIN_SSR_KEY_LENGTH,
  requireAdmin,
  requireSsrKey,
  ssrKeyMatches,
  ssrKeysFromEnv,
} from "./auth.ts";
import { MisconfiguredError } from "./env.ts";

// Chaves de teste (descartaveis, 32+ caracteres). Nenhum segredo real.
const KEY_NEW = "chave-nova-de-teste-0123456789-abcdef";
const KEY_OLD = "chave-antiga-de-teste-0123456789-abcd";

const reader = (vars: Record<string, string>) => (name: string) => vars[name];

function call(key?: string): Request {
  const headers: Record<string, string> = {};
  if (key !== undefined) headers["x-faro-ssr-key"] = key;
  return new Request("http://x/resolve-tag", { method: "POST", headers, body: "{}" });
}

Deno.test("ssrKeysFromEnv: sem FARO_SSR_KEY lanca MisconfiguredError so com o nome", () => {
  const e = assertThrows(() => ssrKeysFromEnv(reader({})), MisconfiguredError);
  assertEquals(e.variable, "FARO_SSR_KEY");
  assertEquals(e.message, "misconfigured: FARO_SSR_KEY");
});

Deno.test("ssrKeysFromEnv: chave curta (menos de 32) e recusada, sem repetir o valor", () => {
  const short = "x".repeat(MIN_SSR_KEY_LENGTH - 1);
  const e = assertThrows(() => ssrKeysFromEnv(reader({ FARO_SSR_KEY: short })), MisconfiguredError);
  assertEquals(e.variable, "FARO_SSR_KEY");
  assert(!e.message.includes(short));
});

Deno.test("ssrKeysFromEnv: so a chave nova, ou a nova e a anterior, nessa ordem", () => {
  assertEquals(ssrKeysFromEnv(reader({ FARO_SSR_KEY: KEY_NEW })), [KEY_NEW]);
  assertEquals(ssrKeysFromEnv(reader({ FARO_SSR_KEY: KEY_NEW, FARO_SSR_KEY_PREVIOUS: KEY_OLD })), [KEY_NEW, KEY_OLD]);
  assertEquals(ssrKeysFromEnv(reader({ FARO_SSR_KEY: KEY_NEW, FARO_SSR_KEY_PREVIOUS: "  " })), [KEY_NEW]);
});

Deno.test("ssrKeysFromEnv: chave anterior curta tambem e recusada", () => {
  const e = assertThrows(
    () => ssrKeysFromEnv(reader({ FARO_SSR_KEY: KEY_NEW, FARO_SSR_KEY_PREVIOUS: "curta" })),
    MisconfiguredError,
  );
  assertEquals(e.variable, "FARO_SSR_KEY_PREVIOUS");
});

Deno.test("requireSsrKey: chamada SEM a chave devolve 401 com corpo vazio", async () => {
  const res = await requireSsrKey(call(), () => [KEY_NEW]);
  assert(res !== null);
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(res.headers.get("cache-control"), "no-store");
});

Deno.test("requireSsrKey: chave errada, vazia, prefixo e variacoes: 401", async () => {
  for (const bad of ["", "errada", KEY_NEW.slice(0, -1), KEY_NEW + "x", KEY_NEW.toUpperCase()]) {
    const res = await requireSsrKey(call(bad), () => [KEY_NEW]);
    assert(res !== null, `chave "${bad}" nao pode passar`);
    assertEquals(res.status, 401);
    assertEquals(await res.text(), "");
  }
});

Deno.test("requireSsrKey: chave certa passa (null)", async () => {
  assertEquals(await requireSsrKey(call(KEY_NEW), () => [KEY_NEW]), null);
});

Deno.test("requireSsrKey: com a rotacao, a chave anterior ainda passa e a nova tambem", async () => {
  const keys = () => [KEY_NEW, KEY_OLD];
  assertEquals(await requireSsrKey(call(KEY_OLD), keys), null);
  assertEquals(await requireSsrKey(call(KEY_NEW), keys), null);
  const res = await requireSsrKey(call(KEY_OLD), () => [KEY_NEW]);
  assert(res !== null);
  assertEquals(res.status, 401);
});

Deno.test("requireSsrKey: configuracao ausente ou fraca devolve 500 e nao atende nem com a chave 'certa'", async () => {
  const notConfigured = await requireSsrKey(call(KEY_NEW), () => {
    throw new MisconfiguredError("FARO_SSR_KEY");
  });
  assert(notConfigured !== null);
  assertEquals(notConfigured.status, 500);
  const body = await notConfigured.text();
  assertEquals(JSON.parse(body), { ok: false, error: "misconfigured" });
  assert(!body.includes("FARO_SSR_KEY"), "o corpo nao diz qual variavel falhou");

  const weak = await requireSsrKey(call("curta"), () => ["curta"]);
  assert(weak !== null);
  assertEquals(weak.status, 500);

  const empty = await requireSsrKey(call(KEY_NEW), () => []);
  assert(empty !== null);
  assertEquals(empty.status, 500);

  const weakPrevious = await requireSsrKey(call(KEY_NEW), () => [KEY_NEW, "curta"]);
  assert(weakPrevious !== null);
  assertEquals(weakPrevious.status, 500);
});

Deno.test("requireSsrKey: erro inesperado ao ler as chaves vira 500 internal_error, sem vazar a mensagem", async () => {
  const res = await requireSsrKey(call(KEY_NEW), () => {
    throw new Error("detalhe-secreto-do-ambiente");
  });
  assert(res !== null);
  assertEquals(res.status, 500);
  const body = await res.text();
  assertEquals(JSON.parse(body), { ok: false, error: "internal_error" });
  assert(!body.includes("detalhe-secreto"));
});

Deno.test("ssrKeyMatches: percorre TODAS as chaves, sem sair no primeiro acerto (tempo constante)", async () => {
  const original = crypto.subtle.digest.bind(crypto.subtle);
  let calls = 0;
  const subtle = crypto.subtle as unknown as { digest: typeof crypto.subtle.digest };
  subtle.digest = (...args: Parameters<typeof crypto.subtle.digest>) => {
    calls++;
    return original(...args);
  };
  try {
    // 1 resumo da chave recebida + 1 por chave aceita, mesmo quando a primeira ja confere.
    assertEquals(await ssrKeyMatches(KEY_NEW, [KEY_NEW, KEY_OLD]), true);
    assertEquals(calls, 3);
    calls = 0;
    assertEquals(await ssrKeyMatches(KEY_OLD, [KEY_NEW, KEY_OLD]), true);
    assertEquals(calls, 3);
    calls = 0;
    assertEquals(await ssrKeyMatches("nenhuma", [KEY_NEW, KEY_OLD]), false);
    assertEquals(calls, 3);
  } finally {
    subtle.digest = original;
  }
});

Deno.test("ssrKeyMatches: cabecalho ausente nunca passa, nem contra chave vazia", async () => {
  assertEquals(await ssrKeyMatches(null, [KEY_NEW]), false);
  assertEquals(await ssrKeyMatches("", [""]), false);
});

Deno.test("bearerToken: extrai so o formato Bearer <token>", () => {
  const r = (h?: string) => new Request("http://x", { headers: h ? { authorization: h } : {} });
  assertEquals(bearerToken(r("Bearer abc.def.ghi")), "abc.def.ghi");
  assertEquals(bearerToken(r("bearer abc")), "abc");
  assertEquals(bearerToken(r("Basic abc")), null);
  assertEquals(bearerToken(r("Bearer")), null);
  assertEquals(bearerToken(r("Bearer a b")), null);
  assertEquals(bearerToken(r()), null);
});

function adminDeps(over: Partial<AdminDeps> = {}, log: string[] = []): AdminDeps {
  return {
    getCaller: (req) => {
      log.push("getCaller");
      return Promise.resolve(req.headers.get("authorization") === "Bearer jwt-do-admin" ? { id: "u-admin" } : null);
    },
    isAdmin: (token) => {
      log.push("isAdmin");
      return Promise.resolve(token === "jwt-do-admin");
    },
    ...over,
  };
}
const withJwt = (jwt?: string) =>
  new Request("http://x/admin-create-batch", { method: "POST", headers: jwt ? { authorization: `Bearer ${jwt}` } : {} });

Deno.test("requireAdmin: sem JWT devolve 401 vazio e nem consulta o banco", async () => {
  const log: string[] = [];
  const r = await requireAdmin(withJwt(), adminDeps({}, log));
  assert(!r.ok);
  assertEquals(r.response.status, 401);
  assertEquals(await r.response.text(), "");
  assertEquals(log, []);
});

Deno.test("requireAdmin: JWT que nao vale (ou a chave anonima) devolve 401", async () => {
  const r = await requireAdmin(withJwt("jwt-invalido"), adminDeps());
  assert(!r.ok);
  assertEquals(r.response.status, 401);
});

Deno.test("requireAdmin: usuario valido que nao e admin recebe 403 forbidden", async () => {
  const deps = adminDeps({
    getCaller: () => Promise.resolve({ id: "u-tutor" }),
    isAdmin: () => Promise.resolve(false),
  });
  const r = await requireAdmin(withJwt("jwt-de-tutor"), deps);
  assert(!r.ok);
  assertEquals(r.response.status, 403);
  assertEquals(JSON.parse(await r.response.text()), { ok: false, error: "forbidden" });
});

Deno.test("requireAdmin: admin passa, com o id e o token (para chamar RPCs com o JWT dele)", async () => {
  const log: string[] = [];
  const r = await requireAdmin(withJwt("jwt-do-admin"), adminDeps({}, log));
  assert(r.ok);
  assertEquals(r.userId, "u-admin");
  assertEquals(r.token, "jwt-do-admin");
  assertEquals(log, ["getCaller", "isAdmin"]);
});

Deno.test("requireAdmin: falha ao consultar o banco e falha fechada (500), nunca passa", async () => {
  const falhaGetCaller = await requireAdmin(
    withJwt("jwt-do-admin"),
    adminDeps({ getCaller: () => Promise.reject(new Error("rede")) }),
  );
  assert(!falhaGetCaller.ok);
  assertEquals(falhaGetCaller.response.status, 500);

  const falhaIsAdmin = await requireAdmin(
    withJwt("jwt-do-admin"),
    adminDeps({ isAdmin: () => Promise.reject(new Error("banco fora")) }),
  );
  assert(!falhaIsAdmin.ok);
  assertEquals(falhaIsAdmin.response.status, 500);

  // isAdmin devolvendo algo que nao seja exatamente true tambem nega.
  const naoBooleano = await requireAdmin(
    withJwt("jwt-do-admin"),
    adminDeps({ isAdmin: () => Promise.resolve("true" as unknown as boolean) }),
  );
  assert(!naoBooleano.ok);
  assertEquals(naoBooleano.response.status, 403);
});
