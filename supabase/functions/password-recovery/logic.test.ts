import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildRecoveryLimits,
  isRecoveryAllowed,
  parseRecoveryEmail,
  remainingWaitMs,
  RESPONSE_FLOOR_MS,
} from "./logic.ts";

// ── Validacao de e-mail: 8 casos ────────────────────────────────────────
const EMAILS: Array<[string, unknown, string, boolean]> = [
  ["e-mail comum", "ana@email.com", "ana@email.com", true],
  ["maiusculas e espacos nas pontas", "  Ana@Email.COM  ", "ana@email.com", true],
  ["sem arroba", "ana.email.com", "ana.email.com", false],
  ["sem dominio", "ana@", "ana@", false],
  ["sem ponto no dominio", "ana@email", "ana@email", false],
  ["com espaco no meio", "ana souza@email.com", "ana souza@email.com", false],
  ["vazio", "", "", false],
  ["acima de 254 caracteres", `${"a".repeat(250)}@e.com`, `${"a".repeat(250)}@e.com`, false],
];

for (const [nome, entrada, email, valido] of EMAILS) {
  Deno.test(`e-mail: ${nome}`, () => {
    assertEquals(parseRecoveryEmail(entrada), { email, valido });
  });
}

Deno.test("e-mail: null, undefined e numero nunca sao validos e nunca lancam", () => {
  assertEquals(parseRecoveryEmail(null).valido, false);
  assertEquals(parseRecoveryEmail(undefined).valido, false);
  assertEquals(parseRecoveryEmail(123).valido, false);
});

Deno.test("e-mail de exatamente 254 caracteres e aceito", () => {
  const e = `${"a".repeat(242)}@example.com`; // 242 + 12 = 254
  assertEquals(e.length, 254);
  assertEquals(parseRecoveryEmail(e).valido, true);
});

// ── Espera ate o piso ───────────────────────────────────────────────────
Deno.test("espera: nada decorrido => o piso inteiro", () => {
  assertEquals(remainingWaitMs(1000, 1000), RESPONSE_FLOOR_MS);
});

Deno.test("espera: parte decorrida => o que falta", () => {
  assertEquals(remainingWaitMs(1000, 1250), 350);
});

Deno.test("espera: passou do piso => zero, nunca negativa", () => {
  assertEquals(remainingWaitMs(1000, 1600), 0);
  assertEquals(remainingWaitMs(1000, 9999), 0);
});

Deno.test("espera: relogio andando para tras nao passa do piso nem fica negativa", () => {
  assertEquals(remainingWaitMs(5000, 4000), RESPONSE_FLOOR_MS);
});

Deno.test("espera: entrada nao numerica devolve o piso (falha segura)", () => {
  assertEquals(remainingWaitMs(NaN, 1000), RESPONSE_FLOOR_MS);
  assertEquals(remainingWaitMs(1000, Infinity), RESPONSE_FLOOR_MS);
});

Deno.test("espera: nunca e negativa em uma varredura", () => {
  for (let elapsed = -2000; elapsed <= 3000; elapsed += 37) {
    const w = remainingWaitMs(10_000, 10_000 + elapsed);
    assertEquals(w >= 0 && w <= RESPONSE_FLOOR_MS, true);
  }
});

// ── Limites e decisao ───────────────────────────────────────────────────
Deno.test("limites: 3 por hora por e-mail e 10 por hora por origem, nessa ordem", () => {
  assertEquals(buildRecoveryLimits("hid", "hip"), [
    { bucket: "recovery:identity:h", key: "hid", max: 3, window: 3600 },
    { bucket: "recovery:ip:h", key: "hip", max: 10, window: 3600 },
  ]);
});

Deno.test("decisao: so allowed === true permite; erro ou resposta estranha negam", () => {
  assertEquals(isRecoveryAllowed({ data: { allowed: true }, error: null }), true);
  assertEquals(isRecoveryAllowed({ data: { allowed: false }, error: null }), false);
  assertEquals(isRecoveryAllowed({ data: { allowed: "true" }, error: null }), false);
  assertEquals(isRecoveryAllowed({ data: null, error: null }), false);
  assertEquals(isRecoveryAllowed({ data: { allowed: true }, error: { message: "x" } }), false);
  assertEquals(isRecoveryAllowed(null), false);
  assertEquals(isRecoveryAllowed(undefined), false);
});
