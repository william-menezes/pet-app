import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSmsLimits,
  isPhoneChange,
  isSameNumber,
  mapBeginError,
  mapDeniedBucket,
  pickTargetPhone,
} from "./logic.ts";

// ── Numero alvo: 5 casos ────────────────────────────────────────────────
Deno.test("alvo 1: phone valido no corpo vence o pendente", () => {
  assertEquals(pickTargetPhone("(11) 98765-4421", "+5521988887777"), { ok: true, phone: "+5511987654421" });
});

Deno.test("alvo 2: phone invalido no corpo => invalido, mesmo havendo pendente valido", () => {
  assertEquals(pickTargetPhone("(11) 3765-4421", "+5521988887777"), { ok: false });
});

Deno.test("alvo 3: sem phone no corpo usa o numero pendente", () => {
  assertEquals(pickTargetPhone(undefined, "+5521988887777"), { ok: true, phone: "+5521988887777" });
  assertEquals(pickTargetPhone(null, "+5521988887777"), { ok: true, phone: "+5521988887777" });
});

Deno.test("alvo 4: sem phone e sem pendente => invalido", () => {
  assertEquals(pickTargetPhone(undefined, null), { ok: false });
});

Deno.test("alvo 5: phone vazio ou de tipo errado conta como informado e e invalido", () => {
  assertEquals(pickTargetPhone("", "+5521988887777"), { ok: false });
  assertEquals(pickTargetPhone(11987654421, "+5521988887777"), { ok: false });
});

// ── Mapeamento de denied_bucket: 3 casos ────────────────────────────────
Deno.test("mapeamento 1: sms:cooldown => cooldown com retry_after_seconds", () => {
  assertEquals(mapDeniedBucket("sms:cooldown", 42), { error: "cooldown", retry_after_seconds: 42 });
});

Deno.test("mapeamento 2: sms:global:d => sms_unavailable, sem retry_after_seconds", () => {
  assertEquals(mapDeniedBucket("sms:global:d", 3600), { error: "sms_unavailable" });
});

Deno.test("mapeamento 3: qualquer outro => rate_limited com retry_after_seconds", () => {
  for (const b of ["sms:account:h", "sms:account:d", "sms:phone:d", "sms:ip:h", "outro", null]) {
    assertEquals(mapDeniedBucket(b, 90), { error: "rate_limited", retry_after_seconds: 90 });
  }
});

Deno.test("mapeamento: retry_after_seconds invalido vira 1 (nunca 0, nunca NaN)", () => {
  assertEquals(mapDeniedBucket("sms:cooldown", 0), { error: "cooldown", retry_after_seconds: 1 });
  assertEquals(mapDeniedBucket("sms:ip:h", Number.NaN), { error: "rate_limited", retry_after_seconds: 1 });
});

// ── Troca e mesmo numero ────────────────────────────────────────────────
Deno.test("decide se e troca", () => {
  assertEquals(isPhoneChange("+5511987654421"), true);
  assertEquals(isPhoneChange(null), false);
});

Deno.test("mesmo numero so quando ha celular confirmado igual ao alvo", () => {
  assertEquals(isSameNumber("+5511987654421", "+5511987654421"), true);
  assertEquals(isSameNumber("+5511987654421", "+5511900000002"), false);
  assertEquals(isSameNumber("+5511987654421", null), false);
});

// ── Os 6 limites ────────────────────────────────────────────────────────
Deno.test("monta os 6 limites sms:* de data-model.md, nesta ordem", () => {
  const limits = buildSmsLimits({ userId: "U", phoneHash: "PH", ipHash: "IH", dailyCap: 500 });
  assertEquals(limits, [
    { bucket: "sms:cooldown", key: "U", max: 1, window: 60 },
    { bucket: "sms:account:h", key: "U", max: 5, window: 3600 },
    { bucket: "sms:account:d", key: "U", max: 10, window: 86400 },
    { bucket: "sms:phone:d", key: "PH", max: 5, window: 86400 },
    { bucket: "sms:ip:h", key: "IH", max: 30, window: 3600 },
    { bucket: "sms:global:d", key: "global", max: 500, window: 86400 },
  ]);
});

Deno.test("o teto global usa SMS_DAILY_CAP", () => {
  const limits = buildSmsLimits({ userId: "U", phoneHash: "PH", ipHash: "IH", dailyCap: 7 });
  assertEquals(limits[5].max, 7);
});

// ── Erros do begin ──────────────────────────────────────────────────────
Deno.test("erros de begin: so os tres do contrato sao mapeados", () => {
  assertEquals(mapBeginError("terms_required"), "terms_required");
  assertEquals(mapBeginError("invalid_phone"), "invalid_phone");
  assertEquals(mapBeginError("same_number"), "same_number");
  assertEquals(mapBeginError("profile_not_found"), null);
  assertEquals(mapBeginError("qualquer coisa do banco"), null);
  assertEquals(mapBeginError(undefined), null);
});
