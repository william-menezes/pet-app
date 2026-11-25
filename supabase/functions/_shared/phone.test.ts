import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BR_MOBILE_E164, normalizeBrPhone } from "./phone.ts";

// Tabela de contracts/shared-edge.contract.md, linha por linha (9 casos).
const CASES: Array<[string, unknown, string | null]> = [
  ["formatado com parenteses", "(11) 98765-4421", "+5511987654421"],
  ["so digitos, 11", "11987654421", "+5511987654421"],
  ["com +55 e espacos", "+55 11 98765-4421", "+5511987654421"],
  ["com 55, 13 digitos", "5511987654421", "+5511987654421"],
  ["fixo", "(11) 3765-4421", null],
  ["DDD invalido", "(01) 98765-4421", null],
  ["outro pais", "+1 415 555 0100", null],
  ["sem DDD", "987654421", null],
  ["vazio, null e numero", "", null],
];

for (const [nome, entrada, saida] of CASES) {
  Deno.test(`normalizeBrPhone: ${nome}`, () => {
    assertEquals(normalizeBrPhone(entrada), saida);
  });
}

Deno.test("normalizeBrPhone: null e numero (nao string) => null", () => {
  assertEquals(normalizeBrPhone(null), null);
  assertEquals(normalizeBrPhone(123), null);
  assertEquals(normalizeBrPhone(undefined), null);
});

Deno.test("BR_MOBILE_E164 e o mesmo padrao do banco", () => {
  assertEquals(BR_MOBILE_E164.source, String.raw`^\+55[1-9][0-9]9[0-9]{8}$`);
});
