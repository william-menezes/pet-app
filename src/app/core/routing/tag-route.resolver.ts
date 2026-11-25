/**
 * tag-route.resolver.ts — T029/T030 (spec 003)
 *
 * Resolvedor da rota `/<código>`. Faz o SSR esperar a resposta do `resolve-tag` antes de serializar o
 * HTML (com detecção de mudança sem zona, um `fetch` solto não seria aguardado). O serviço entra por
 * `import()` para não pesar no pacote inicial além do necessário.
 */
import { Injector, inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { TagResolution } from '../../models';

export const resolveTagRoute: ResolveFn<TagResolution> = (route) => {
  const injector = inject(Injector);
  const segment = route.paramMap.get('codigo') ?? '';
  return import('../tags/public-tag.service').then((m) => injector.get(m.PublicTagService).resolve(segment));
};
