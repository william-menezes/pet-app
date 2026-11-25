import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isCaptchaFailure, MAX_CAPTCHA_TOKEN_LENGTH, parseCaptchaToken } from "./captcha.ts";

Deno.test("parseCaptchaToken: ausente, null e vazio => sem token", () => {
  assertEquals(parseCaptchaToken(undefined), { ok: true, token: undefined });
  assertEquals(parseCaptchaToken(null), { ok: true, token: undefined });
  assertEquals(parseCaptchaToken(""), { ok: true, token: undefined });
});

Deno.test("parseCaptchaToken: string de ate 2048 caracteres => o token", () => {
  assertEquals(parseCaptchaToken("abc"), { ok: true, token: "abc" });
  const max = "t".repeat(MAX_CAPTCHA_TOKEN_LENGTH);
  assertEquals(parseCaptchaToken(max), { ok: true, token: max });
});

Deno.test("parseCaptchaToken: 2049 caracteres, numero, objeto e array => recusa (400)", () => {
  assertEquals(parseCaptchaToken("t".repeat(MAX_CAPTCHA_TOKEN_LENGTH + 1)), { ok: false });
  assertEquals(parseCaptchaToken(123), { ok: false });
  assertEquals(parseCaptchaToken({}), { ok: false });
  assertEquals(parseCaptchaToken(["x"]), { ok: false });
  assertEquals(parseCaptchaToken(true), { ok: false });
});

Deno.test("isCaptchaFailure: codigo captcha_failed ou mensagem que cita captcha", () => {
  assertEquals(isCaptchaFailure({ code: "captcha_failed", message: "x" }), true);
  assertEquals(isCaptchaFailure({ message: "captcha verification process failed" }), true);
  assertEquals(isCaptchaFailure({ code: "invalid_credentials", message: "Invalid login credentials" }), false);
  assertEquals(isCaptchaFailure({ code: "over_email_send_rate_limit" }), false);
  assertEquals(isCaptchaFailure(null), false);
  assertEquals(isCaptchaFailure(undefined), false);
  assertEquals(isCaptchaFailure("captcha"), false);
});
