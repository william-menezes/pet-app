import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { codeHashInput, hmacSha256Hex, phoneHashInput, sha256SaltedHex } from "./hash.ts";

Deno.test("HMAC-SHA256: vetor da RFC 4231, caso 2", async () => {
  assertEquals(
    await hmacSha256Hex("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});

Deno.test("sha256SaltedHex = SHA-256(value + salt), igual ao login-guard", async () => {
  // SHA-256("abc") = ba7816bf...; com value="a" e salt="bc" a entrada concatenada e "abc".
  assertEquals(
    await sha256SaltedHex("a", "bc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("entradas de hash do telefone e do codigo", () => {
  assertEquals(phoneHashInput("+5511987654421"), "phone|+5511987654421");
  assertEquals(
    codeHashInput("11111111-1111-1111-1111-111111111111", "+5511987654421", "482913"),
    "code|11111111-1111-1111-1111-111111111111|+5511987654421|482913",
  );
});
