/**
 * lazy-guard.ts — T034B (spec 003; contrato de integração §5.2)
 *
 * Carrega um guard `canMatch` sob demanda. Os guards vivem em `core/auth` e `core/account`, que puxam o
 * `@supabase/supabase-js`; se `app.routes.ts` os importasse de forma estática, o pacote que a página
 * pública baixa levaria a autenticação junto. Com este auxiliar o `import()` só roda quando a rota
 * protegida é avaliada.
 *
 * O injetor é capturado de forma síncrona: depois do `import()` não há mais contexto de injeção.
 * O guard carregado roda nesse injetor e pode devolver valor, `Promise` ou `Observable`.
 */
import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import type { CanMatchFn, GuardResult, MaybeAsync } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

export function lazyCanMatch(load: () => Promise<CanMatchFn>): CanMatchFn {
  return (route, segments) => {
    const injector = inject(EnvironmentInjector);
    return load().then((guard) => {
      const result: MaybeAsync<GuardResult> = runInInjectionContext(injector, () => guard(route, segments));
      return isObservable(result) ? firstValueFrom(result) : result;
    });
  };
}
