/**
 * activation.guard.ts — T042 (spec 003)
 *
 * `CanMatchFn` de `/ativar/:code`. Vai na frente de `authGuard`/`termsGuard`/`phoneConfirmedGuard` (o roteador dá
 * prioridade ao primeiro guard que não devolve `true`).
 *
 *  - Código que não passa na normalização e no dígito: não decide nada (a tela mostra "Confira o código"); não há
 *    ativação pendente a guardar.
 *  - Sem sessão: `/auth/criar-conta?returnUrl=/ativar/<código normalizado>`. Quem tem a tag na mão quase sempre
 *    ainda não tem conta; o cadastro devolve para cá.
 *  - Com sessão: guarda o código com `set_pending_activation` (idempotente; falha de rede não trava a tela) e deixa
 *    passar para os guards seguintes.
 *
 * Guard é só experiência: a autorização é do banco. Carregado por `lazyCanMatch`, porque puxa o supabase-js.
 */
import { Injector, inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import { isValid, normalize } from '../tag-code';
import { activationPath } from './activation-links';
import { TagService } from './tag.service';

export const activationGuard: CanMatchFn = async (_route: Route, segments: UrlSegment[]) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const injector = inject(Injector);

  const code = normalize(segments[1]?.path ?? segments[0]?.path ?? '');
  if (!isValid(code)) return true;

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/criar-conta'], { queryParams: { returnUrl: activationPath(code) } });
  }

  // Não espera erro: se a RPC falhar, o fluxo segue e a ativação não depende desse registro.
  await injector.get(TagService).setPendingActivation(code);
  return true;
};
