import { TestBed } from '@angular/core/testing';

import { FOCINHO } from '../logo/brand-assets';
import { Focinho } from './focinho';

describe('Focinho', () => {
  function render(label?: string): SVGElement {
    const fixture = TestBed.createComponent(Focinho);
    if (label !== undefined) {
      fixture.componentRef.setInput('label', label);
    }
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('svg') as unknown as SVGElement;
  }

  it('sem label é decorativo: aria-hidden e sem role', () => {
    const svg = render();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
  });

  it('com label vira imagem nomeada: role="img" e aria-label', () => {
    const svg = render('Faro');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Faro');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('usa o desenho e o viewBox de brand-assets, na cor do texto', () => {
    const svg = render();
    expect(svg.getAttribute('viewBox')).toBe(FOCINHO.viewBox);
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(FOCINHO.path);
  });
});
