/**
 * IP de origem confiavel (mesma ordem do login-guard). Nunca le IP do corpo da requisicao
 * (anti-spoofing). O IP so existe aqui para virar hash: nunca em log nem em banco em claro.
 */
export function getTrustedIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown"
  );
}
