import { TestBed } from '@angular/core/testing';

import { GoogleGlyph } from './google-glyph';

describe('GoogleGlyph', () => {
  it('o "G" tem as quatro cores oficiais, 20px e é decorativo', () => {
    const fixture = TestBed.createComponent(GoogleGlyph);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as unknown as SVGElement;
    const fills = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853']);
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
  });
});
