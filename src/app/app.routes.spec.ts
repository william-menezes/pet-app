import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Route, type Routes } from '@angular/router';

import { routes } from './app.routes';
import { looksLikeTagCode, tagCodeMatcher } from './core/routing/tag-matcher';

@Component({ template: '' })
class Stub {}

/**
 * Cópia das rotas reais sem guard, sem resolvedor e com `Stub` no lugar de cada componente: o que se
 * confere aqui é QUAL rota casa com cada endereço, não o que a tela faz.
 */
function stripped(list: Routes): Routes {
  return list.map((route): Route => {
    const { canMatch, resolve, loadComponent, loadChildren, children, ...rest } = route;
    void canMatch;
    void resolve;
    void loadComponent;
    void loadChildren;
    return { ...rest, component: Stub, ...(children ? { children: stripped(children) } : {}) };
  });
}

/** Rota-folha ativa depois de navegar. */
async function leafAfter(url: string): Promise<Route | null> {
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  let snap = router.routerState.snapshot.root;
  while (snap.firstChild) snap = snap.firstChild;
  return snap.routeConfig;
}

describe('app.routes (T024)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(stripped(routes))] }));

  it.each([
    ['/app', '', 'Início — Faro'],
    ['/app/pets', 'pets', undefined],
    ['/app/pets/abc', 'pets/:petId', undefined],
    ['/app/pets/abc/editar', 'app/pets/:petId/editar', undefined],
    ['/app/tag/7K3M-Q9XA-C', 'tag/:code', undefined],
    ['/app/pets/abc/visibilidade', 'pets/:petId/visibilidade', undefined],
    ['/app/pets/abc/modo-perdido', 'pets/:petId/modo-perdido', undefined],
    ['/app/pets/abc/tag', 'pets/:petId/tag', undefined],
    ['/app/scans', 'scans', undefined],
    ['/app/conta', 'conta', undefined],
    ['/admin', '', 'Lotes — Faro'],
    ['/admin/codigos', 'codigos', undefined],
    ['/admin/codigos/7K3M-Q9XA-C', 'codigos/:code', undefined],
    ['/admin/fila', 'fila', undefined],
    ['/admin/auditoria', 'auditoria', undefined],
    ['/novo-pet', 'novo-pet', undefined],
    ['/ativar/7K3M-Q9XA-C', 'ativar/:code', undefined],
    ['/vincular/abc', 'vincular/:petId', undefined],
    ['/auth/login', 'login', undefined],
    ['/legal/termos', 'legal/termos', undefined],
  ])('%s casa com a rota "%s"', async (url, path, title) => {
    const leaf = await leafAfter(url);
    if (url === '/app/conta') {
      // As filhas de `conta` vêm de `loadChildren` (retirado aqui): basta casar com a rota `conta` ou o `**`.
      expect(leaf?.path === 'conta' || leaf?.path === '**').toBe(true);
      return;
    }
    expect(leaf?.path, url).toBe(path);
    if (title !== undefined) expect(leaf?.title).toBe(title);
  });

  it.each(['/7k3m-q9xa-c', '/7K3M-Q9XA-C', '/7K3MQ9XAC', '/7k3m%20q9xa%20c', '/7K3MQ9XAD'])(
    '%s casa com a página da tag',
    async (url) => {
      const leaf = await leafAfter(url);
      expect(leaf?.matcher).toBe(tagCodeMatcher);
    },
  );

  it.each(['/qualquer-coisa', '/7K3MQ9XA', '/U2345678X', '/7K3MQ9XAC/perdido', '/app2'])(
    '%s cai na página "não encontrada" do app, na raiz',
    async (url) => {
      const leaf = await leafAfter(url);
      expect(leaf?.path, url).toBe('**');
      expect(leaf?.title).toBe('Página não encontrada — Faro');
    },
  );

  it('o `**` da raiz e o casador do código vêm depois de todas as rotas fixas', () => {
    const last = routes.slice(-2);
    expect(last[0].matcher).toBe(tagCodeMatcher);
    expect(last[1].path).toBe('**');
    const fixed = routes.slice(0, -2);
    expect(fixed.every((route) => route.matcher === undefined)).toBe(true);
  });

  it('a rota antiga `:codigo/perdido` não existe mais', () => {
    expect(routes.some((route) => route.path?.includes('perdido'))).toBe(false);
  });

  /** Princípio VIII (contrato de integração §1.5): rota fixa nunca esconde uma tag. */
  it('nenhum segmento fixo de um segmento só tem 9 caracteres do alfabeto do código depois de normalizado', () => {
    const firstSegments = new Set(
      routes
        .filter((route) => route.path !== undefined && route.path !== '' && route.path !== '**')
        .map((route) => (route.path as string).split('/')[0])
        .filter((segment) => !segment.startsWith(':')),
    );
    // `api` é do servidor Express (src/server.ts), não do roteador: também entra na regra.
    ['api', 'app', 'admin', 'auth', 'ativar', 'legal', 'dev', 'novo-pet', 'vincular'].forEach((s) => firstSegments.add(s));
    expect(firstSegments.size).toBeGreaterThan(5);
    for (const segment of firstSegments) {
      expect(looksLikeTagCode(segment), `"${segment}" parece um código de tag`).toBe(false);
    }
  });
});
