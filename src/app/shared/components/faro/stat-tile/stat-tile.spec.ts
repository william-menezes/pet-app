import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StatTile } from './stat-tile';

describe('StatTile', () => {
  function render(inputs: Record<string, string | null>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StatTile);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sem link é um cartão comum com rótulo, valor e legenda', () => {
    const el = render({ label: 'Scans este mês', value: '3', caption: 'O último foi hoje' });
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('[data-testid="stat-tile-label"]')?.textContent).toContain('Scans este mês');
    expect(el.querySelector('[data-testid="stat-tile-value"]')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('[data-testid="stat-tile-caption"]')?.textContent).toContain('O último foi hoje');
  });

  it('com link o cartão inteiro vira um <a>', () => {
    const el = render({ label: 'Scans', value: '5 de 7', link: '/app/scans' });
    const anchor = el.querySelector('a') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('/app/scans');
    expect(anchor.querySelector('[data-testid="stat-tile-value"]')).not.toBeNull();
    expect(anchor.classList.contains('bg-card')).toBe(true);
  });

  it('o valor usa a receita Número de resumo (38px, 40px no desktop)', () => {
    const value = render({ label: 'x', value: '1' }).querySelector('[data-testid="stat-tile-value"]') as HTMLElement;
    for (const cls of ['font-display', 'font-bold', 'text-[38px]', 'xl:text-[40px]', 'text-foreground']) {
      expect(value.classList.contains(cls), cls).toBe(true);
    }
  });

  it('o cartão é rounded-xl bg-card p-4, sem borda e sem sombra', () => {
    const card = render({ label: 'x', value: '1' }).querySelector('[data-testid="stat-tile-card"]') as HTMLElement;
    for (const cls of ['rounded-xl', 'bg-card', 'p-4']) {
      expect(card.classList.contains(cls), cls).toBe(true);
    }
    expect(card.className).not.toMatch(/\bborder\b|shadow/);
  });

  it('sem legenda não desenha o texto da legenda', () => {
    expect(render({ label: 'x', value: '1' }).querySelector('[data-testid="stat-tile-caption"]')).toBeNull();
  });
});
