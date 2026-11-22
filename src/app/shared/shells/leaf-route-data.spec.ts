import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { leafRouteData } from './leaf-route-data';

@Component({ template: '' })
class Empty {}

describe('leafRouteData', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'raiz', component: Empty, data: { hub: true } },
          { path: 'pai', component: Empty, children: [{ path: 'filho', component: Empty, data: { hub: true } }] },
          { path: 'interna', component: Empty },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    const hub = runInInjectionContext(TestBed.inject(Injector), () => leafRouteData<boolean>('hub'));
    return { router, hub };
  }

  it("devolve true numa rota com data: { hub: true } e undefined em outra", async () => {
    const { router, hub } = await setup();
    await router.navigateByUrl('/raiz');
    expect(hub()).toBe(true);
    await router.navigateByUrl('/interna');
    expect(hub()).toBeUndefined();
  });

  it('lê a rota-folha, não a do pai', async () => {
    const { router, hub } = await setup();
    await router.navigateByUrl('/pai/filho');
    expect(hub()).toBe(true);
  });
});
