/**
 * Espera em linguagem corrente, para o "{tempo}" de "Muitos pedidos de código. Tente de novo em {tempo}."
 * (contratos `phone-verify-start.edge.md` e `frontend-services.contract.md` §4). Arredonda para cima.
 */
export function formatWait(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return $localize`alguns minutos`;
  }
  if (seconds < 90) return $localize`1 minuto`;
  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return $localize`${minutes}:minutes: minutos`;
  }
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? $localize`1 hora` : $localize`${hours}:hours: horas`;
}
