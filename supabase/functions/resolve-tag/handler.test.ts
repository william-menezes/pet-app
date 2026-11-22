import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fakeClock, postJson } from "../_shared/testing.ts";
import { createResolveHandler, RESOLVE_FLOOR_MS, type ResolveDeps } from "./handler.ts";

// Chave de teste (descartavel, 32+ caracteres). Nenhum segredo real.
const KEY = "chave-de-teste-resolve-0123456789-abc";
const CODE = "ABCDEFGHV"; // vetor sintetico valido (formato ABCD-EFGH-V)
const H = { "x-faro-ssr-key": KEY };

type RpcReply = { data: unknown; error: unknown } | "throw";

function setup(reply: RpcReply, opts: { sign?: (p: string) => Promise<string | null>; keys?: () => string[] } = {}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const signed: string[] = [];
  const clock = fakeClock();
  const deps: ResolveDeps = {
    keys: opts.keys ?? (() => [KEY]),
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return reply === "throw" ? Promise.reject(new Error("banco fora do ar")) : Promise.resolve(reply);
    },
    signPhoto: opts.sign ?? ((p) => {
      signed.push(p);
      return Promise.resolve(`https://storage.test/assinada/${p}?token=t`);
    }),
    now: clock.now,
    sleep: clock.sleep,
  };
  return { handler: createResolveHandler(deps), calls, signed, slept: clock.state.slept };
}

const ok = (data: unknown): RpcReply => ({ data, error: null });
const PROFILE = {
  code: "ABCD-EFGH-V",
  pet: { name: "Paçoca", photo_path: "tutor/pet/foto.jpg" },
  temperament: ["Dócil com pessoas", "Medo de barulho"],
  care_notes: "Toma remédio de manhã.",
  tutor_first_name: "Ana",
  whatsapp_url: "https://wa.me/5511987654421?text=Oi%21",
  phone_display: "(11) 98765-4421",
  lost: { since: "2026-11-19T12:00:00Z", reward: true, message: "Ele se assusta." },
};

async function bodyOf(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

Deno.test("sem a chave: 401 de corpo vazio e a RPC nao e chamada", async () => {
  const t = setup(ok({ state: "not_found" }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }));
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(t.calls.length, 0);
});

Deno.test("chave errada: 401 de corpo vazio", async () => {
  const t = setup(ok({ state: "not_found" }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, { "x-faro-ssr-key": KEY + "x" }));
  assertEquals(res.status, 401);
  assertEquals(await res.text(), "");
  assertEquals(t.calls.length, 0);
});

Deno.test("chave de servidor fraca (menos de 32 caracteres): 500 e nao atende", async () => {
  const t = setup(ok({ state: "not_found" }), { keys: () => ["curta"] });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, { "x-faro-ssr-key": "curta" }));
  assertEquals(res.status, 500);
  assertEquals(t.calls.length, 0);
});

Deno.test("metodo diferente de POST (com a chave): 405", async () => {
  const t = setup(ok({ state: "not_found" }));
  const res = await t.handler(new Request("http://x/fn", { method: "GET", headers: H }));
  assertEquals(res.status, 405);
});

Deno.test("digito verificador invalido: not_found SEM tocar o banco, com o piso de 150 ms", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }));
  const res = await t.handler(postJson({ code: "7K3MQ9XAD", ip_hash: "h" }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { state: "not_found" });
  assertEquals(t.calls.length, 0);
  assertEquals(t.slept, [RESOLVE_FLOOR_MS]);
});

Deno.test("entrada fora do formato: not_found 200 sem tocar o banco", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }));
  const inputs: unknown[] = ["isto nao e json", "[]", { ip_hash: "h" }, { code: 123 }, { code: "A".repeat(65) }, { code: "x".repeat(3000) }];
  for (const input of inputs) {
    const res = await t.handler(postJson(input, H));
    assertEquals(res.status, 200);
    assertEquals(await bodyOf(res), { state: "not_found" });
  }
  assertEquals(t.calls.length, 0);
});

Deno.test("normaliza minusculas e hifens e manda o codigo canonico e o ip_hash para a RPC", async () => {
  const t = setup(ok({ state: "not_found" }));
  await t.handler(postJson({ code: "abcd-efgh-v", ip_hash: "hash-do-ip" }, H));
  assertEquals(t.calls, [{ fn: "resolve_tag", args: { p_code: CODE, p_ip_hash: "hash-do-ip" } }]);
});

Deno.test("ip_hash ausente ou longo demais: usa 'unknown'", async () => {
  const t = setup(ok({ state: "not_found" }));
  await t.handler(postJson({ code: CODE }, H));
  await t.handler(postJson({ code: CODE, ip_hash: "h".repeat(129) }, H));
  assertEquals(t.calls.map((c) => c.args.p_ip_hash), ["unknown", "unknown"]);
});

Deno.test("estado disponivel: devolve o codigo formatado, com o piso", async () => {
  const t = setup(ok({ state: "available", code: "QUALQUER" }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { state: "available", code: "ABCD-EFGH-V" });
  assertEquals(t.slept, [RESOLVE_FLOOR_MS]);
});

Deno.test("estado rate_limited: passa adiante, com o piso", async () => {
  const t = setup(ok({ state: "rate_limited" }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(await bodyOf(res), { state: "rate_limited" });
  assertEquals(t.slept, [RESOLVE_FLOOR_MS]);
});

Deno.test("estado assigned: perfil campo a campo, foto assinada, sem piso de tempo", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), {
    state: "assigned",
    profile: {
      code: "ABCD-EFGH-V",
      pet: { name: "Paçoca", photo_url: "https://storage.test/assinada/tutor/pet/foto.jpg?token=t" },
      temperament: ["Dócil com pessoas", "Medo de barulho"],
      care_notes: "Toma remédio de manhã.",
      tutor_first_name: "Ana",
      whatsapp_url: "https://wa.me/5511987654421?text=Oi%21",
      phone_display: "(11) 98765-4421",
      lost: { since: "2026-11-19T12:00:00Z", reward: true, message: "Ele se assusta." },
    },
  });
  assertEquals(t.signed, ["tutor/pet/foto.jpg"]);
  assertEquals(t.slept, []);
});

Deno.test("estado assigned: a resposta nunca carrega o caminho da foto nem campo desconhecido da RPC", async () => {
  const t = setup(ok({
    state: "assigned",
    profile: { ...PROFILE, tutor_id: "uuid-do-tutor", ip_hash: "h", activation_pin_hash: "$2a$12$x", pet: { ...PROFILE.pet, id: "uuid-do-pet" } },
    assignment_id: "uuid",
  }));
  const text = await (await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))).text();
  for (const forbidden of ["photo_path", "tutor_id", "uuid", "ip_hash", "activation_pin_hash", "$2a$", "assignment_id"]) {
    assertFalse(text.includes(forbidden), `nao pode conter ${forbidden}`);
  }
});

Deno.test("estado assigned: campo desligado (ausente na RPC) nao aparece, nem como null", async () => {
  const t = setup(ok({ state: "assigned", profile: { code: "ABCD-EFGH-V", pet: { name: "Rex" } } }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  const text = await res.text();
  assertEquals(JSON.parse(text), { state: "assigned", profile: { code: "ABCD-EFGH-V", pet: { name: "Rex" } } });
  assertFalse(text.includes("null"));
  assertEquals(t.signed.length, 0);
});

Deno.test("estado assigned: whatsapp_url fora de https://wa.me/ e descartada", async () => {
  const t = setup(ok({ state: "assigned", profile: { ...PROFILE, whatsapp_url: "https://evil.example/x" } }));
  const body = await bodyOf(await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))) as { profile: Record<string, unknown> };
  assertFalse("whatsapp_url" in body.profile);
});

Deno.test("estado assigned: modo perdido sem campo liberado vira lost vazio", async () => {
  const t = setup(ok({ state: "assigned", profile: { ...PROFILE, lost: {} } }));
  const body = await bodyOf(await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))) as { profile: { lost: unknown } };
  assertEquals(body.profile.lost, {});
});

Deno.test("foto: falha da assinatura entrega o perfil sem photo_url (so a foto falha)", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }), { sign: () => Promise.reject(new Error("storage fora do ar")) });
  const body = await bodyOf(await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))) as { state: string; profile: { pet: Record<string, unknown> } };
  assertEquals(body.state, "assigned");
  assertEquals(body.profile.pet, { name: "Paçoca" });
});

Deno.test("foto: assinatura que devolve null entrega o perfil sem photo_url", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }), { sign: () => Promise.resolve(null) });
  const body = await bodyOf(await t.handler(postJson({ code: CODE, ip_hash: "h" }, H))) as { profile: { pet: Record<string, unknown> } };
  assertEquals(body.profile.pet, { name: "Paçoca" });
});

Deno.test("Rescue-First: RPC que lanca excecao NUNCA vira erro tecnico: 200 com rate_limited (contingencia) e o piso", async () => {
  const t = setup("throw");
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { state: "rate_limited" });
  assertEquals(t.slept, [RESOLVE_FLOOR_MS]);
});

Deno.test("Rescue-First: erro da RPC (ex.: banco recusou) tambem vira 200 com rate_limited", async () => {
  const t = setup({ data: null, error: { message: "falha interna" } });
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(res.status, 200);
  assertEquals(await bodyOf(res), { state: "rate_limited" });
});

Deno.test("resposta da RPC fora do formato (lixo, estado desconhecido, perfil sem nome): 200 com rate_limited", async () => {
  for (const data of [null, "texto", [], { state: "outro" }, { state: "assigned" }, { state: "assigned", profile: { pet: {} } }]) {
    const t = setup(ok(data));
    const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
    assertEquals(res.status, 200);
    assertEquals(await bodyOf(res), { state: "rate_limited" });
  }
});

Deno.test("anti-enumeracao: inexistente, bloqueado e anulado (a RPC responde o mesmo) dao corpo e cabecalhos identicos", async () => {
  const responses: Response[] = [];
  for (const code of [CODE, "ZZZZZZZZ8", "TVWXYZ01S"]) {
    const t = setup(ok({ state: "not_found" }));
    responses.push(await t.handler(postJson({ code, ip_hash: "h" }, H)));
  }
  const bodies = await Promise.all(responses.map((r) => r.text()));
  assertEquals(new Set(bodies).size, 1);
  assertEquals(bodies[0], '{"state":"not_found"}');
  const headers = responses.map((r) => JSON.stringify([...r.headers.entries()].sort()));
  assertEquals(new Set(headers).size, 1);
  // E o mesmo corpo e os mesmos cabecalhos de um codigo com digito invalido (que nem chega ao banco).
  const t = setup(ok({ state: "assigned", profile: PROFILE }));
  const invalid = await t.handler(postJson({ code: "7K3MQ9XAD", ip_hash: "h" }, H));
  assertEquals(await invalid.text(), bodies[0]);
  assertEquals(JSON.stringify([...invalid.headers.entries()].sort()), headers[0]);
});

Deno.test("toda resposta autorizada sai sem cache", async () => {
  const t = setup(ok({ state: "assigned", profile: PROFILE }));
  const res = await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  assertEquals(res.headers.get("cache-control"), "no-store");
  assert((res.headers.get("content-type") ?? "").startsWith("application/json"));
});

Deno.test("a funcao nao escreve log (nada de codigo, ip ou perfil no console)", async () => {
  const original = console.log;
  const lines: unknown[][] = [];
  console.log = (...a: unknown[]) => void lines.push(a);
  try {
    const t = setup(ok({ state: "assigned", profile: PROFILE }));
    await t.handler(postJson({ code: CODE, ip_hash: "h" }, H));
    const t2 = setup("throw");
    await t2.handler(postJson({ code: CODE, ip_hash: "h" }, H));
  } finally {
    console.log = original;
  }
  assertEquals(lines.length, 0);
});
