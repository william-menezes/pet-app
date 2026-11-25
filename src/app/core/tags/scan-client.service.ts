/**
 * scan-client.service.ts — T054 (spec 003; `public-page.contract.md`)
 *
 * Chamadas do NAVEGADOR ao servidor do app, depois da hidratação:
 *  - `registerScan(code)`: `POST /api/scan`. Abrir o HTML não gera scan (robôs de pré-visualização e o
 *    próprio dono gerariam avisos falsos): o scan nasce desta chamada. Devolve `{ owner, scan_token? }`;
 *    qualquer falha devolve `{ owner: false }` (a página nunca depende dela);
 *  - `sendLocation(token, position)`: `POST /api/scan/location`, SÓ depois de um toque do visitante e do
 *    consentimento do navegador. Devolve se a localização foi gravada.
 * Nunca chama o Supabase nem as Edge Functions direto: só o servidor do app, que tem a chave.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ScanResponse } from '../../models';
import { OwnerProbe } from './owner-probe.service';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracyM: number;
}

@Injectable({ providedIn: 'root' })
export class ScanClient {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly probe = inject(OwnerProbe);

  async registerScan(code: string, fetchFn: typeof fetch = fetch): Promise<ScanResponse> {
    if (!this.isBrowser) return { owner: false };
    try {
      const token = await this.probe.accessToken();
      const response = await fetchFn('/api/scan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token !== null ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return { owner: false };
      const data: unknown = await response.json();
      const body = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
      if (body['owner'] === true) return { owner: true };
      const scanToken = body['scan_token'];
      return typeof scanToken === 'string' && scanToken !== ''
        ? { owner: false, scan_token: scanToken }
        : { owner: false };
    } catch {
      return { owner: false };
    }
  }

  async sendLocation(scanToken: string, position: GeoPosition, fetchFn: typeof fetch = fetch): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      const response = await fetchFn('/api/scan/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scan_token: scanToken,
          lat: position.lat,
          lng: position.lng,
          accuracy_m: Math.round(position.accuracyM),
        }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return false;
      const data: unknown = await response.json();
      return typeof data === 'object' && data !== null && (data as Record<string, unknown>)['updated'] === true;
    } catch {
      return false;
    }
  }
}
