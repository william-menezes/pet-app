/**
 * "há 5 horas", "há 2 dias" a partir de um instante ISO 8601: o tempo desde que o modo perdido foi ligado, para o
 * app do tutor. Horas até 48 h e depois dias, como na página pública (`public-page.contract.md`). `null` se a data
 * for inválida ou estiver no futuro além da folga de relógio.
 */
export function lostElapsedLabel(sinceIso: string, now: number = Date.now()): string | null {
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return null;
  const minutes = Math.floor((now - since) / 60_000);
  if (minutes < -5) return null;
  if (minutes < 60) return $localize`há poucos minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? $localize`há 1 hora` : $localize`há ${hours}:hours: horas`;
  const days = Math.floor(hours / 24);
  return $localize`há ${days}:days: dias`;
}
