/**
 * public-tag.service.ts — T029 (spec 003; contrato `public-page.contract.md`)
 *
 * Fonte dos dados da página da tag, `/<código>`:
 *  - no SERVIDOR chama o resolvedor (`resolve-tag`) com tempo limite de 2,5 s e guarda o resultado no
 *    `TransferState`; erro, limite estourado ou tempo esgotado viram `contingency`: a página nunca
 *    cai em erro técnico (Princípio I);
 *  - no NAVEGADOR só lê o estado transferido; sem ele (navegação interna, e não o documento do
 *    servidor) devolve `contingency`, cujo "Tentar de novo" é um link comum que refaz o pedido ao servidor.
 *
 * O dígito verificador é conferido ANTES de qualquer chamada: código inválido é `not_found` sem rede.
 * Nenhuma chamada direta ao Supabase: o navegador nem tem a chave do servidor.
 */
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { isValid, normalize } from '../tag-code/tag-code';
import type { TagResolution } from '../../models';
import { SERVER_TAG_RESOLVER } from './tag-resolver.token';

/** Tempo limite da chamada ao `resolve-tag` (contrato: 2,5 s). */
export const RESOLVE_TIMEOUT_MS = 2500;

const CONTINGENCY: TagResolution = { state: 'contingency' };
const NOT_FOUND: TagResolution = { state: 'not_found' };

/** Uma chave por código: o estado transferido é só da página aberta. */
export const tagStateKey = (code: string) => makeStateKey<TagResolution>(`faro-tag:${code}`);

@Injectable({ providedIn: 'root' })
export class PublicTagService {
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly transferState = inject(TransferState);
  private readonly serverResolver = inject(SERVER_TAG_RESOLVER, { optional: true });

  /** `raw` é o segmento da URL como veio (qualquer caixa, com ou sem hífen). */
  async resolve(raw: string, timeoutMs: number = RESOLVE_TIMEOUT_MS): Promise<TagResolution> {
    const code = normalize(raw);
    if (!isValid(code)) return NOT_FOUND;

    const key = tagStateKey(code);
    if (!this.isServer) return this.transferState.get(key, CONTINGENCY);

    const result = await this.fromServer(code, timeoutMs);
    this.transferState.set(key, result);
    return result;
  }

  private async fromServer(code: string, timeoutMs: number): Promise<TagResolution> {
    if (!this.serverResolver) return CONTINGENCY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<TagResolution>((resolve) => {
      timer = setTimeout(() => resolve(CONTINGENCY), timeoutMs);
    });
    try {
      return await Promise.race([this.serverResolver(code).catch(() => CONTINGENCY), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
