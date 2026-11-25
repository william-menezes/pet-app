import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadEnv, MisconfiguredError } from "./env.ts";

const BASE: Record<string, string> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "anon-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
  HASH_SALT: "local-dev-salt-0123456789",
  PHONE_OTP_PEPPER: "local-dev-pepper-0123456789-abcdefghij",
  FARO_ENV: "local",
};

const reader = (over: Record<string, string | undefined> = {}) => {
  const m: Record<string, string | undefined> = { ...BASE, ...over };
  return (n: string) => m[n];
};

Deno.test("carrega o caso feliz", () => {
  const env = loadEnv({ pepper: true }, reader());
  assertEquals(env.faroEnv, "local");
  assertEquals(env.smsDailyCap, 500);
  assertEquals(env.smsDriver, "");
  assertEquals(env.smsStubCode, null);
});

for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "HASH_SALT"]) {
  Deno.test(`${name} ausente => MisconfiguredError`, () => {
    assertThrows(() => loadEnv({}, reader({ [name]: undefined })), MisconfiguredError);
  });
}

Deno.test("HASH_SALT curto (< 16) => MisconfiguredError", () => {
  assertThrows(() => loadEnv({}, reader({ HASH_SALT: "curto-demais" })), MisconfiguredError);
});

Deno.test("HASH_SALT com exatamente 16 caracteres passa", () => {
  assertEquals(loadEnv({}, reader({ HASH_SALT: "0123456789abcdef" })).hashSalt.length, 16);
});

Deno.test("pepper obrigatorio so quando need.pepper", () => {
  assertThrows(() => loadEnv({ pepper: true }, reader({ PHONE_OTP_PEPPER: undefined })), MisconfiguredError);
  assertEquals(loadEnv({}, reader({ PHONE_OTP_PEPPER: undefined })).otpPepper, "");
});

Deno.test("pepper curto (< 32) => MisconfiguredError", () => {
  assertThrows(() => loadEnv({ pepper: true }, reader({ PHONE_OTP_PEPPER: "curto" })), MisconfiguredError);
});

Deno.test("pepper com exatamente 32 caracteres passa", () => {
  const p = "0123456789abcdef0123456789abcdef";
  assertEquals(loadEnv({ pepper: true }, reader({ PHONE_OTP_PEPPER: p })).otpPepper, p);
});

Deno.test("FARO_ENV ausente => production", () => {
  assertEquals(loadEnv({}, reader({ FARO_ENV: undefined })).faroEnv, "production");
});

Deno.test("FARO_ENV fora da lista => production", () => {
  assertEquals(loadEnv({}, reader({ FARO_ENV: "dev" })).faroEnv, "production");
});

Deno.test("FARO_ENV aceita local, test, staging e production", () => {
  for (const v of ["local", "test", "staging", "production"]) {
    assertEquals(loadEnv({}, reader({ FARO_ENV: v })).faroEnv, v);
  }
});

Deno.test("SMS_STUB_CODE so e lido com SMS_DRIVER=stub", () => {
  assertEquals(loadEnv({}, reader({ SMS_DRIVER: "log", SMS_STUB_CODE: "424242" })).smsStubCode, null);
  assertEquals(loadEnv({}, reader({ SMS_DRIVER: "stub", SMS_STUB_CODE: "424242" })).smsStubCode, "424242");
});

Deno.test("SMS_STUB_CODE invalido com stub => null", () => {
  assertEquals(loadEnv({}, reader({ SMS_DRIVER: "stub", SMS_STUB_CODE: "12" })).smsStubCode, null);
});

Deno.test("SMS_DAILY_CAP: valor valido, invalido e zero", () => {
  assertEquals(loadEnv({}, reader({ SMS_DAILY_CAP: "50" })).smsDailyCap, 50);
  assertEquals(loadEnv({}, reader({ SMS_DAILY_CAP: "abc" })).smsDailyCap, 500);
  assertEquals(loadEnv({}, reader({ SMS_DAILY_CAP: "0" })).smsDailyCap, 500);
});

Deno.test("a mensagem do erro traz o nome da variavel e nunca o valor", () => {
  let caught: Error | null = null;
  try {
    loadEnv({ pepper: true }, reader({ PHONE_OTP_PEPPER: "segredo-curto" }));
  } catch (e) {
    caught = e as Error;
  }
  assertEquals(caught !== null, true);
  assertEquals(caught!.message.includes("segredo-curto"), false);
  assertEquals(caught!.message.includes("PHONE_OTP_PEPPER"), true);
});

// Chave publica: o hospedado injeta SUPABASE_PUBLISHABLE_KEYS (JSON) e, como legada, SUPABASE_ANON_KEY; o local, a anon.
const NO_ANON = { SUPABASE_ANON_KEY: undefined };

Deno.test("chave publica: SUPABASE_PUBLISHABLE_KEYS (default) tem prioridade sobre a anon legada", () => {
  const env = loadEnv({}, reader({ SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_teste"}' }));
  assertEquals(env.anonKey, "sb_publishable_teste");
});

Deno.test("chave publica: so o dicionario, sem a anon legada, e aceito (hospedado sem chaves legadas)", () => {
  const env = loadEnv({}, reader({ ...NO_ANON, SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_teste"}' }));
  assertEquals(env.anonKey, "sb_publishable_teste");
});

Deno.test("chave publica: sem 'default', usa a primeira chave texto do dicionario", () => {
  const env = loadEnv({}, reader({ ...NO_ANON, SUPABASE_PUBLISHABLE_KEYS: '{"web":"sb_publishable_web"}' }));
  assertEquals(env.anonKey, "sb_publishable_web");
});

Deno.test("chave publica: SUPABASE_PUBLISHABLE_KEY (valor unico) vale quando nao ha dicionario", () => {
  const env = loadEnv({}, reader({ ...NO_ANON, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unica" }));
  assertEquals(env.anonKey, "sb_publishable_unica");
});

Deno.test("chave publica: dicionario invalido cai para a anon legada", () => {
  const env = loadEnv({}, reader({ SUPABASE_PUBLISHABLE_KEYS: "{nao-e-json" }));
  assertEquals(env.anonKey, "anon-test-key");
});

Deno.test("chave publica: nenhuma das tres => MisconfiguredError (falha fechada)", () => {
  assertThrows(
    () => loadEnv({}, reader({ ...NO_ANON, SUPABASE_PUBLISHABLE_KEYS: '{"default":"  "}' })),
    MisconfiguredError,
  );
});
