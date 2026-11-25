/**
 * Hashes das Edge Functions (contracts/shared-edge.contract.md).
 *  - ip_hash e hash de identidade: SHA-256(valor + HASH_SALT), compativel com a 001 (login-guard).
 *  - phone_hash e code_hash: HMAC-SHA256 com PHONE_OTP_PEPPER.
 */

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message)));
}

/** SHA-256(value + salt): mesmo esquema do login-guard. */
export async function sha256SaltedHex(value: string, salt: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value + salt)));
}

export function phoneHashInput(e164: string): string {
  return "phone|" + e164;
}

export function codeHashInput(userId: string, e164: string, code: string): string {
  return "code|" + userId + "|" + e164 + "|" + code;
}
