import type { Scan } from '../../models';

const TIME_ZONE = 'America/Sao_Paulo';
const MS_DAY = 86_400_000;

/** Ano, mês e dia de um instante no horário de Brasília. */
function ymd(date: Date): { y: string; m: string; d: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

const dayKey = (date: Date): string => {
  const { y, m, d } = ymd(date);
  return `${y}-${m}-${d}`;
};

/** "Hoje, 14:32", "Ontem, 18:47" ou "16 nov, 09:10" (horário de Brasília). */
export function formatScanTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const hour = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  const key = dayKey(at);
  if (key === dayKey(now)) return $localize`Hoje, ${hour}:hour:`;
  if (key === dayKey(new Date(now.getTime() - MS_DAY))) return $localize`Ontem, ${hour}:hour:`;
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: 'short' }).format(at).replace(' de ', ' ').replace('.', '');
  return `${day}, ${hour}`;
}

/** "Hoje às 14:32", "Ontem às 18:47" ou "16 nov às 09:10" (horário de Brasília). */
export function formatScanWhen(iso: string, now: Date = new Date()): string {
  return formatScanTime(iso, now).replace(', ', ' às ');
}

/** "hoje", "ontem" ou "16 nov" (horário de Brasília). */
export function formatScanDay(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const key = dayKey(at);
  if (key === dayKey(now)) return $localize`hoje`;
  if (key === dayKey(new Date(now.getTime() - MS_DAY))) return $localize`ontem`;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: 'short' }).format(at).replace(' de ', ' ').replace('.', '');
}

/** "Novembro 2026". */
export function monthLabel(iso: string): string {
  const text = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, month: 'long', year: 'numeric' }).format(new Date(iso));
  const [month, ...rest] = text.replace(' de ', ' ').split(' ');
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${rest.join(' ')}`.trim();
}

export interface ScanMonthGroup {
  key: string;
  label: string;
  scans: Scan[];
}

/** Agrupa por mês, mantendo a ordem recebida (mais novos primeiro). */
export function groupByMonth(scans: readonly Scan[]): ScanMonthGroup[] {
  const groups: ScanMonthGroup[] = [];
  for (const scan of scans) {
    const { y, m } = ymd(new Date(scan.occurredAt));
    const key = `${y}-${m}`;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.scans.push(scan);
    else groups.push({ key, label: monthLabel(scan.occurredAt), scans: [scan] });
  }
  return groups;
}

/** Raio, em metros, que o mapa desenha: o do erro informado; sem ele, 3 km para a área aproximada pelo IP. */
export function scanRadiusMeters(scan: Scan): number {
  if (scan.accuracyM !== null && scan.accuracyM > 0) return scan.accuracyM;
  return scan.geoMethod === 'ip' ? 3000 : 50;
}

/** "~3 km" ou "± 15 m". */
export function formatRadius(meters: number, approximate: boolean): string {
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    const text = String(km).replace('.', ',');
    return approximate ? `~${text} km` : `± ${text} km`;
  }
  const rounded = Math.round(meters);
  return approximate ? `~${rounded} m` : `± ${rounded} m`;
}

export function scanHasLocation(scan: Scan): boolean {
  return scan.geoMethod !== 'none' && scan.lat !== null && scan.lng !== null;
}
