import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidCodeFormat, mapConfirmStatus } from "./logic.ts";

// ── Formato do codigo: 6 casos ──────────────────────────────────────────
const FORMATOS: Array<[string, unknown, boolean]> = [
  ["6 digitos", "482913", true],
  ["zeros a esquerda", "000123", true],
  ["5 digitos", "12345", false],
  ["7 digitos", "1234567", false],
  ["com letra ou espaco", "12a456", false],
  ["nao e string", 482913, false],
];

for (const [nome, entrada, esperado] of FORMATOS) {
  Deno.test(`formato do codigo: ${nome}`, () => {
    assertEquals(isValidCodeFormat(entrada), esperado);
  });
}

Deno.test("formato do codigo: vazio, null, undefined, com quebra de linha", () => {
  assertEquals(isValidCodeFormat(""), false);
  assertEquals(isValidCodeFormat(null), false);
  assertEquals(isValidCodeFormat(undefined), false);
  assertEquals(isValidCodeFormat("123456\n"), false);
});

// ── Mapeamento de status ────────────────────────────────────────────────
const PHONE = "+5511987654421";

Deno.test("status confirmed => sucesso com o telefone", () => {
  assertEquals(mapConfirmStatus({ status: "confirmed" }, PHONE), { ok: true, phone: PHONE });
});

Deno.test("status invalid => invalid_code com attempts_left", () => {
  assertEquals(mapConfirmStatus({ status: "invalid", attempts_left: 3 }, PHONE), {
    ok: false,
    error: "invalid_code",
    attempts_left: 3,
  });
});

Deno.test("status locked => locked com attempts_left 0", () => {
  assertEquals(mapConfirmStatus({ status: "locked", attempts_left: 0 }, PHONE), {
    ok: false,
    error: "locked",
    attempts_left: 0,
  });
});

Deno.test("status expired e no_active => iguais", () => {
  assertEquals(mapConfirmStatus({ status: "expired" }, PHONE), { ok: false, error: "expired" });
  assertEquals(mapConfirmStatus({ status: "no_active" }, PHONE), { ok: false, error: "no_active" });
});

Deno.test("status desconhecido ou resposta invalida => null (nunca sucesso)", () => {
  assertEquals(mapConfirmStatus({ status: "qualquer" }, PHONE), null);
  assertEquals(mapConfirmStatus({}, PHONE), null);
  assertEquals(mapConfirmStatus(null, PHONE), null);
  assertEquals(mapConfirmStatus("confirmed", PHONE), null);
});

Deno.test("a resposta nunca carrega hash, id de verificacao ou o codigo", () => {
  const reply = mapConfirmStatus(
    { status: "invalid", attempts_left: 2, code_hash: "x", verification_id: "y" },
    PHONE,
  );
  assertEquals(Object.keys(reply as object).sort(), ["attempts_left", "error", "ok"]);
});
