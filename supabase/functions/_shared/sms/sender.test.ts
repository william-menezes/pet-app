import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOtpMessage, resolveSender, type SmsSender } from "./sender.ts";

type FaroEnvName = "local" | "test" | "staging" | "production";
const e = (smsDriver: string, faroEnv: FaroEnvName) => ({ smsDriver, faroEnv });

// Tabela de resolveSender, linha 1: log/stub em local/test => driver simulado.
Deno.test("resolveSender: log e stub em local/test => driver simulado", () => {
  for (const driver of ["log", "stub"]) {
    for (const env of ["local", "test"] as const) {
      assertEquals(resolveSender(e(driver, env)) !== null, true, `${driver}/${env}`);
    }
  }
});

// Linha 2: log/stub em staging, production, ausente ou outro => null.
Deno.test("resolveSender: log e stub fora de local/test => null (recusado)", () => {
  for (const driver of ["log", "stub"]) {
    for (const env of ["staging", "production"] as const) {
      assertStrictEquals(resolveSender(e(driver, env)), null, `${driver}/${env}`);
    }
  }
  // FARO_ENV ausente ou invalido vira 'production' em loadEnv.
  assertStrictEquals(resolveSender(e("log", "production")), null);
});

// Linha 3: vazio ou desconhecido => null, em qualquer FARO_ENV.
Deno.test("resolveSender: driver vazio ou desconhecido => null", () => {
  for (const env of ["local", "test", "staging", "production"] as const) {
    assertStrictEquals(resolveSender(e("", env)), null);
    assertStrictEquals(resolveSender(e("provedor-inexistente", env)), null);
    assertStrictEquals(resolveSender(e("constructor", env)), null);
  }
});

// Linha 4: nome de um driver real => o driver (nenhum existe ainda: TODO(SMS_PROVIDER); injeta-se um falso).
Deno.test("resolveSender: nome de driver real registrado => o driver, em qualquer FARO_ENV", () => {
  const fake: SmsSender = { send: () => Promise.resolve({ ok: true, providerId: "falso" }) };
  for (const env of ["local", "test", "staging", "production"] as const) {
    assertStrictEquals(resolveSender(e("real", env), { real: () => fake }), fake);
  }
});

Deno.test("driver log escreve [sms:log] com os ultimos 4 digitos e o texto", async () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.join(" "));
  };
  try {
    const sender = resolveSender(e("log", "local"))!;
    const r = await sender.send("+5511987654421", buildOtpMessage("482913"));
    assertEquals(r.ok, true);
  } finally {
    console.log = original;
  }
  assertEquals(lines.length, 1);
  assertEquals(lines[0].startsWith("[sms:log] para=4421 texto=Faro: seu codigo e 482913."), true);
  assertEquals(lines[0].includes("+5511987654421"), false);
});

Deno.test("driver stub devolve ok e nao escreve nada no log", async () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.join(" "));
  };
  try {
    const r = await resolveSender(e("stub", "test"))!.send("+5511987654421", buildOtpMessage("424242"));
    assertEquals(r.ok, true);
  } finally {
    console.log = original;
  }
  assertEquals(lines, []);
});

Deno.test("buildOtpMessage: texto exato do contrato", () => {
  assertEquals(
    buildOtpMessage("482913"),
    "Faro: seu codigo e 482913. Vale por 10 minutos. Nao compartilhe.\n@tagfaro.com.br #482913",
  );
});
