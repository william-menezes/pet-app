import { TestBed } from '@angular/core/testing';

import { LOGO } from './brand-assets';
import { Logo } from './logo';

describe('Logo', () => {
  function render(inputs: { height?: number; tone?: 'on-light' | 'on-dark' } = {}): HTMLImageElement {
    const fixture = TestBed.createComponent(Logo);
    if (inputs.height !== undefined) {
      fixture.componentRef.setInput('height', inputs.height);
    }
    if (inputs.tone) {
      fixture.componentRef.setInput('tone', inputs.tone);
    }
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('img') as HTMLImageElement;
  }

  it('com height=48 a largura é 127 (proporção 770:290)', () => {
    const img = render({ height: 48 });
    expect(img.getAttribute('width')).toBe('127');
    expect(img.getAttribute('height')).toBe('48');
  });

  it('as alturas usadas nas telas têm a largura da proporção', () => {
    for (const height of [40, 44, 48, 52, 60, 64]) {
      expect(render({ height }).getAttribute('width')).toBe(String(Math.round((height * LOGO.width) / LOGO.height)));
    }
  });

  it('o tom pedido escolhe o arquivo', () => {
    expect(render({ tone: 'on-light' }).getAttribute('src')).toBe(LOGO.onLight);
    expect(render({ tone: 'on-dark' }).getAttribute('src')).toBe(LOGO.onDark);
  });

  it('o padrão é sobre fundo claro, com 48px e alt "Faro"', () => {
    const img = render();
    expect(img.getAttribute('src')).toBe(LOGO.onLight);
    expect(img.getAttribute('height')).toBe('48');
    expect(img.getAttribute('alt')).toBe('Faro');
    expect(img.getAttribute('decoding')).toBe('async');
  });
});
