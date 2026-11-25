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

  // DEF-003-03: a <ol> do ngx-sonner não pode ser lista (os avisos são regiões vivas), e o aviso continua anunciado.
  it('a lista do aviso não tem papel de lista e cada aviso segue com aria-live', async () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardSonnerComponent);
    fixture.detectChanges();
    const id = TestBed.inject(ZardSonnerService).show('Dados atualizados.');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ol[data-sonner-toaster]')?.getAttribute('role')).toBe('presentation');
    expect(el.querySelector('li[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    TestBed.inject(ZardSonnerService).dismiss(id);
  });

  it('fica no topo, ao centro, e o tema é claro', () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardSonnerComponent);
    expect(fixture.componentInstance.position()).toBe('top-center');
    expect(fixture.componentInstance.theme()).toBe('light');
  });
});
