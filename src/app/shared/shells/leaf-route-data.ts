import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, type ActivatedRouteSnapshot } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

function leafOf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = snapshot;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return current;
}

/**
 * Valor de `data[key]` da rota-folha ativa; atualiza a cada `NavigationEnd` (contrato §2.4).
 * Só pode ser chamada em contexto de injeção.
 */
export function leafRouteData<T>(key: string): Signal<T | undefined> {
  const router = inject(Router);
  const read = (): T | undefined => leafOf(router.routerState.snapshot.root).data[key] as T | undefined;
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(read),
    ),
    { initialValue: read() },
  );
}
