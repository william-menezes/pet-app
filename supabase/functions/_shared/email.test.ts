import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { faroEnvFrom, resolveEmailSender } from "./email.ts";

const MSG = { to: "ana@faro.test", subject: "Assunto de teste", html: "<p>corpo secreto</p>", text: "corpo secreto" };

Deno.test("resolveEmailSender: sem driver ou driver desconhecido => null (nada e enviado)", () => {
  assertEquals(resolveEmailSender({ emailDriver: "", faroEnv: "local" }), null);
  assertEquals(resolveEmailSender({ emailDriver: "google", faroEnv: "production" }), null);
  assertEquals(resolveEmailSender({ emailDriver: "toString", faroEnv: "local" }), null);
});

Deno.test("resolveEmailSender: log e stub so existem com FARO_ENV local ou test", () => {
  for (const driver of ["log", "stub"]) {
    for (const faroEnv of ["local", "test"]) assert(resolveEmailSender({ emailDriver: driver, faroEnv }) !== null);
    for (const faroEnv of ["staging", "production", ""]) assertEquals(resolveEmailSender({ emailDriver: driver, faroEnv }), null);
  }
});

Deno.test("driver real injetado so e usado pelo nome", async () => {
  const real = { google: () => ({ send: () => Promise.resolve({ ok: true, providerId: "g" }) }) };
  const s = resolveEmailSender({ emailDriver: "google", faroEnv: "production" }, real);
  assertEquals(await s?.send(MSG), { ok: true, providerId: "g" });
});

Deno.test("driver log escreve so o assunto (nunca o endereco nem o corpo)", async () => {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  try {
    const r = await resolveEmailSender({ emailDriver: "log", faroEnv: "test" })?.send(MSG);
    assertEquals(r?.ok, true);
  } finally {
    console.log = original;
  }
  assertEquals(lines, ["[email:log] assunto=Assunto de teste"]);
  assertFalse(lines.join("").includes("ana@faro.test"));
  assertFalse(lines.join("").includes("secreto"));
});

Deno.test("driver stub nao escreve nada", async () => {
  const original = console.log;
  let wrote = 0;
  console.log = () => void wrote++;
  try {
    assertEquals((await resolveEmailSender({ emailDriver: "stub", faroEnv: "local" })?.send(MSG))?.ok, true);
  } finally {
    console.log = original;
  }
  assertEquals(wrote, 0);
});

Deno.test("faroEnvFrom: valor invalido ou ausente e production (falha fechada)", () => {
  assertEquals(faroEnvFrom(undefined), "production");
  assertEquals(faroEnvFrom("dev"), "production");
  assertEquals(faroEnvFrom(" test "), "test");
  assertEquals(faroEnvFrom("local"), "local");
  assertEquals(faroEnvFrom("staging"), "staging");
});
