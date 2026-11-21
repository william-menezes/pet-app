import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { ZardSonnerComponent } from './sonner.component';
import { ZardSonnerService } from './sonner.service';

describe('ZardSonnerComponent', () => {
  // O jsdom não tem matchMedia, que o ngx-sonner consulta ao montar.
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }),
    });
  });

  it('o aviso temporário usa as cores --toast, iguais nos dois temas', async () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardSonnerComponent);
    fixture.detectChanges();
    const id = TestBed.inject(ZardSonnerService).show('Dados atualizados.');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('--normal-bg: var(--toast)');
    expect(html).toContain('--normal-text: var(--toast-foreground)');
    TestBed.inject(ZardSonnerService).dismiss(id);
  });

  it('fica no topo, ao centro, e o tema é claro', () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardSonnerComponent);
    expect(fixture.componentInstance.position()).toBe('top-center');
    expect(fixture.componentInstance.theme()).toBe('light');
  });
});
