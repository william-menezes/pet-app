import { InjectionToken } from '@angular/core';
import type { TagResolution } from '../../models';

/**
 * Resolvedor do servidor: recebe o código canônico (já validado) e devolve a resolução. Só o
 * `app.config.server.ts` o fornece (usa `process.env`, `node:crypto` e a chave do servidor); no
 * navegador o token não existe, e o `PublicTagService` lê o estado transferido.
 */
export type ServerTagResolver = (code: string) => Promise<TagResolution>;

export const SERVER_TAG_RESOLVER = new InjectionToken<ServerTagResolver>('SERVER_TAG_RESOLVER');
