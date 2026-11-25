import { Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { of } from 'rxjs';

import { lazyCanMatch } from './lazy-guard';

@Injectable({ providedIn: 'root' })
class Marker {
  readonly value = 'injetado';
}

const route = {} as Route;
const segments = [] as UrlSegment[];

describe('lazyCanMatch (T034B)', () => {
  const run = (guard: CanMatchFn) => TestBed.runInInjectionContext(() => guard(route, segments));

  it('só carrega o guard quando a rota é avaliada', async () => {
    const load = vi.fn().mockResolvedValue((() => true) as CanMatchFn);
    const guard = lazyCanMatch(load);
    expect(load).not.toHaveBeenCalled();
    await run(guard);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('devolve o valor do guard carregado (boolean, árvore de URL, Promise e Observable)', async () => {
    const tree = TestBed.inject(Router).parseUrl('/auth');
    expect(await run(lazyCanMatch(() => Promise.resolve(() => true)))).toBe(true);
    expect(await run(lazyCanMatch(() => Promise.resolve(() => tree)))).toBe(tree);
    expect(await run(lazyCanMatch(() => Promise.resolve(() => Promise.resolve(false))))).toBe(false);
    expect(await run(lazyCanMatch(() => Promise.resolve(() => of(true))))).toBe(true);
  });

  it('o guard carregado roda com contexto de injeção, mesmo depois do await do import()', async () => {
    const guard: CanMatchFn = () => inject(Marker).value === 'injetado';
    expect(await run(lazyCanMatch(() => Promise.resolve(guard)))).toBe(true);
  });

  it('repassa a rota e os segmentos ao guard', async () => {
    const inner = vi.fn<CanMatchFn>().mockReturnValue(true);
    await run(lazyCanMatch(() => Promise.resolve(inner)));
    expect(inner).toHaveBeenCalledWith(route, segments);
  });
});
