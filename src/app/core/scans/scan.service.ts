/**
 * ScanService — T055 (spec 003)
 *
 * Histórico de scans do tutor: lê a visão `my_scans` (sem `ip_hash` e sem token), que a RLS já filtra pelos
 * vínculos do próprio tutor. Scans de um vínculo antigo nunca aparecem para quem recebeu a tag depois
 * (isolamento entre vínculos, garantido pelo banco).
 *
 * Nenhuma mensagem do Supabase é exposta.
 */
import { Injectable, inject } from '@angular/core';

import type { GeoMethod, Scan } from '../../models';
import { SupabaseService } from '../supabase/supabase.service';

export type ScanPeriod = 'all' | 'month';

export interface ScanFilters {
  /** `month`: só os do mês corrente (no horário de Brasília). */
  period?: ScanPeriod;
  /** Só scans com a localização que quem escaneou enviou pelo navegador (GPS). */
  preciseOnly?: boolean;
  /** Só os de um pet. */
  petId?: string;
  /** No máximo isto (os mais novos). Sem valor: `SCAN_LIMIT`. */
  limit?: number;
}

export type ScanListResult = { ok: true; scans: Scan[] } | { ok: false; error: 'network' };

/** O histórico mostra no máximo isto; os mais novos primeiro. */
export const SCAN_LIMIT = 200;

const TIME_ZONE = 'America/Sao_Paulo';

interface ScanRow {
  id: string;
  tag_code: string;
  pet_id: string | null;
  occurred_at: string;
  geo_method: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  city: string | null;
  region: string | null;
}

/**
 * Primeiro instante do mês de `now` no horário de Brasília, em ISO com deslocamento. O Brasil não tem horário de
 * verão desde 2019: o deslocamento é fixo em -03:00.
 */
export function startOfMonthIso(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}-01T00:00:00-03:00`;
}

const isGeo = (v: string): v is GeoMethod => v === 'none' || v === 'ip' || v === 'gps';

function toScan(row: ScanRow): Scan | null {
  if (typeof row.id !== 'string' || typeof row.occurred_at !== 'string' || !isGeo(row.geo_method)) return null;
  return {
    id: row.id,
    tagCode: row.tag_code,
    petId: row.pet_id,
    occurredAt: row.occurred_at,
    geoMethod: row.geo_method,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    city: row.city,
    region: row.region,
  };
}

@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly supabase = inject(SupabaseService);

  /** Scans do tutor, do mais novo para o mais antigo. `now` existe para os testes. */
  async list(filters: ScanFilters = {}, now: Date = new Date()): Promise<ScanListResult> {
    try {
      let query = this.supabase.client
        .from('my_scans')
        .select('id, tag_code, pet_id, occurred_at, geo_method, lat, lng, accuracy_m, city, region')
        .order('occurred_at', { ascending: false })
        .limit(Math.min(Math.max(1, Math.floor(filters.limit ?? SCAN_LIMIT)), SCAN_LIMIT));
      if (filters.period === 'month') query = query.gte('occurred_at', startOfMonthIso(now));
      if (filters.preciseOnly) query = query.eq('geo_method', 'gps');
      if (filters.petId) query = query.eq('pet_id', filters.petId);

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return { ok: false, error: 'network' };
      const scans = (data as ScanRow[]).map(toScan);
      if (scans.some((s) => s === null)) return { ok: false, error: 'network' };
      return { ok: true, scans: scans as Scan[] };
    } catch {
      return { ok: false, error: 'network' };
    }
  }
}
