import { TestBed } from '@angular/core/testing';

import { BRAND_HEADLINE, BRAND_SUB } from './brand-copy';
import { BrandPanel } from './brand-panel';

describe('BrandPanel', () => {
  function render(inputs: { variant?: 'page' | 'flow'; headline?: string[]; sub?: string } = {}): HTMLElement {
    const fixture = TestBed.createComponent(BrandPanel);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('a frase vira uma linha por item de headline', () => {
    const el = render({ headline: BRAND_HEADLINE });
    const lines = el.querySelectorAll('[data-testid="brand-panel-headline"] > span');
    expect(Array.from(lines).map((l) => l.textContent?.trim())).toEqual(['O caminho', 'de volta', 'para casa.']);
  });

  it('a frase é um <p>, não um título', () => {
    const el = render({ headline: BRAND_HEADLINE });
    expect(el.querySelector('[data-testid="brand-panel-headline"]')?.tagName).toBe('P');
    expect(el.querySelector('h1, h2, h3')).toBeNull();
  });

  it('sem headline nem apoio, não desenha a frase', () => {
    const el = render();
    expect(el.querySelector('[data-testid="brand-panel-headline"]')).toBeNull();
    expect(el.querySelector('[data-testid="brand-panel-sub"]')).toBeNull();
  });

  it('o apoio padrão aparece em text-brand-muted', () => {
    const sub = render({ sub: BRAND_SUB }).querySelector('[data-testid="brand-panel-sub"]') as HTMLElement;
    expect(sub.textContent).toContain('A tag com QR Code');
    expect(sub.classList).toContain('text-brand-muted');
    expect(sub.classList).toContain('max-w-[420px]');
  });

  it('o hospedeiro é navy, com o texto branco, e corta o focinho que sangra', () => {
    const host = render();
    for (const cls of ['relative', 'flex', 'flex-col', 'overflow-hidden', 'bg-brand', 'text-brand-foreground']) {
      expect(host.classList.contains(cls), cls).toBe(true);
    }
  });

  it('o focinho é lima, decorativo, e a variante muda o tamanho no desktop', () => {
    const page = render({ variant: 'page' }).querySelector('app-focinho') as HTMLElement;
    const flow = render({ variant: 'flow' }).querySelector('app-focinho') as HTMLElement;
    expect(page.classList.contains('text-primary')).toBe(true);
    expect(page.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(page.classList.contains('xl:w-[640px]')).toBe(true);
    expect(flow.classList.contains('xl:w-[560px]')).toBe(true);
  });

  it('a frase do desktop usa 72px na variante page e 56px na flow', () => {
    const page = render({ variant: 'page', headline: ['a'] }).querySelector('[data-testid="brand-panel-headline"]') as HTMLElement;
    const flow = render({ variant: 'flow', headline: ['a'] }).querySelector('[data-testid="brand-panel-headline"]') as HTMLElement;
    expect(page.classList.contains('xl:text-[72px]')).toBe(true);
    expect(flow.classList.contains('xl:text-[56px]')).toBe(true);
    expect(page.classList.contains('leading-none')).toBe(true);
  });

  it('o wordmark usa as letras brancas, em duas alturas (52 e 60)', () => {
    const imgs = render().querySelectorAll('img');
    expect(Array.from(imgs).map((i) => i.getAttribute('height'))).toEqual(['52', '60']);
  });
});

describe('BrandPanel · focinho gigante no desktop', () => {
  const classes = (variant: 'page' | 'flow') => {
    const fixture = TestBed.createComponent(BrandPanel);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="brand-panel-focinho"]')?.className ?? '';
  };

  it('na variante flow o focinho fica deslocado para a direita, longe do logo (o e2e mede o respiro de 24px)', () => {
    expect(classes('flow')).toContain('xl:-right-[245px]');
  });

  it('a variante page não mudou', () => {
    expect(classes('page')).toContain('xl:-right-[190px]');
  });
});
