import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import vectors from "../../../src/app/core/tag-code/fixtures/tag-code.vectors.json" with { type: "json" };
import { checkDigit, format, isValid, newCode, normalize, TAG_ALPHABET, TAG_DOMAIN, tagUrl } from "./tag-code.ts";

// A copia do modulo usada pelas Edge Functions contra os mesmos vetores sinteticos do app e do SQL.
// (A igualdade byte a byte com src/app/core/tag-code/tag-code.ts e conferida por tag-code.sync.spec.ts.)

Deno.test("tag-code (Deno): o alfabeto dos vetores e o do contrato", () => {
  assertEquals(vectors.alphabet, TAG_ALPHABET);
  assertEquals(TAG_DOMAIN, "TAGFARO.COM.BR");
});

Deno.test("tag-code (Deno): cada valid confere checkDigit, isValid, format e tagUrl", () => {
  assert(vectors.valid.length >= 40);
  for (const v of vectors.valid) {
    assertEquals(checkDigit(v.body), v.check, `checkDigit(${v.body})`);
    assert(isValid(v.code), `isValid(${v.code})`);
    assert(isValid(v.display), `isValid(${v.display})`);
    assertEquals(format(v.code), v.display);
    assertEquals(tagUrl(v.display), `HTTPS://TAGFARO.COM.BR/${v.code}`);
  }
});

Deno.test("tag-code (Deno): cada invalid e falso", () => {
  assert(vectors.invalid.length >= 30);
  for (const code of vectors.invalid) assert(!isValid(code), `isValid(${JSON.stringify(code)})`);
});

Deno.test("tag-code (Deno): cada par de normalize confere", () => {
  for (const [entrada, esperado] of vectors.normalize) assertEquals(normalize(entrada), esperado);
});

Deno.test("tag-code (Deno): newCode gera codigos validos e a fonte curta e recusada", () => {
  for (let i = 0; i < 2000; i++) {
    const code = newCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    assertEquals(code.length, 9);
    assert(isValid(code));
  }
  assertThrows(() => newCode(() => new Uint8Array(3)), RangeError);
  assertThrows(() => format("7K3MQ9XAD"), RangeError);
});
