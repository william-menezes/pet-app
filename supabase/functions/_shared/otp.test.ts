import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateCode, resolveCode } from "./otp.ts";

Deno.test("generateCode: 10.000 codigos, todos com 6 digitos", () => {
  for (let i = 0; i < 10_000; i++) assertMatch(generateCode(), /^[0-9]{6}$/);
});

Deno.test("generateCode: nao e constante", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(generateCode());
  assertEquals(seen.size > 100, true);
});

const STUB = "424242";
const env = (smsDriver: string, faroEnv: "local" | "test" | "staging" | "production") => ({
  smsDriver,
  faroEnv,
  smsStubCode: STUB,
});

Deno.test("resolveCode: stub + local => codigo fixo", () => {
  assertEquals(resolveCode(env("stub", "local")), STUB);
});

Deno.test("resolveCode: stub + test => codigo fixo", () => {
  assertEquals(resolveCode(env("stub", "test")), STUB);
});

Deno.test("resolveCode: stub + staging/production => aleatorio, nao o fixo", () => {
  for (const e of ["staging", "production"] as const) {
    const draws = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = resolveCode(env("stub", e));
      assertMatch(code, /^[0-9]{6}$/);
      draws.add(code);
    }
    // Um valor constante seria o codigo fixo; varios valores distintos provam o sorteio.
    assertEquals(draws.size > 1, true);
  }
});

Deno.test("resolveCode: driver log (mesmo local) => aleatorio, nunca o fixo", () => {
  const draws = new Set<string>();
  for (let i = 0; i < 50; i++) draws.add(resolveCode(env("log", "local")));
  assertEquals(draws.size > 1, true);
});

Deno.test("resolveCode: stub sem codigo configurado => aleatorio", () => {
  const draws = new Set<string>();
  for (let i = 0; i < 50; i++) {
    draws.add(resolveCode({ smsDriver: "stub", faroEnv: "local", smsStubCode: null }));
  }
  assertEquals(draws.size > 1, true);
});
