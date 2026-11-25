/**
 * guard-url.ts — T027 (spec 004)
 *
 * Num `CanMatchFn`, `segments` são só os segmentos que sobram para a rota que declara o guard:
 * numa filha de `auth` o guard de `/auth/termos` vê `[termos]`. Para guardar o destino
 * (`returnUrl`) precisa-se do caminho completo, que vem da navegação em curso. Sem navegação em
 * curso (teste de unidade), usa os segmentos.
 */
import type { Router, UrlSegment } from '@angular/router';

export function requestedUrl(router: Router, segments: UrlSegment[]): string {
  const nav = router.getCurrentNavigation();
  if (nav) return router.serializeUrl(nav.extractedUrl);
  return '/' + segments.map((s) => s.path).join('/');
}
