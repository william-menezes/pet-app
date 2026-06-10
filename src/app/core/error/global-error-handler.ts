import { ErrorHandler, Injectable } from '@angular/core';

/**
 * ErrorHandler global da fundação (Observabilidade & Confiabilidade — Princípio VII).
 *
 * MVP: log estruturado no console. Hook para telemetria (ex.: Sentry) e correlação de
 * eventos sensíveis (scans, mudanças de plano) entra nas features de observabilidade.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Faro] Unhandled error:', err.message, err);
  }
}
