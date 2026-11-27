/** Como a posição de um scan foi obtida (`scan_events.geo_method`). */
export type GeoMethod = 'none' | 'ip' | 'gps';

/** Leitura do QR vista pelo tutor (visão `my_scans`: sem `ip_hash` e sem token). */
export interface Scan {
  id: string;
  /** Código canônico de 9 caracteres. */
  tagCode: string;
  petId: string | null;
  occurredAt: string;
  geoMethod: GeoMethod;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  city: string | null;
  region: string | null;
}

/** Resposta de `POST /api/scan` (`public-page.contract.md`). Em falha: `{ owner: false }`. */
export interface ScanResponse {
  owner: boolean;
  scan_token?: string;
}
