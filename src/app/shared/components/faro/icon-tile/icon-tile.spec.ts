import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { IconTile, type IconTileTone } from './icon-tile';

describe('IconTile', () => {
  function render(tone?: IconTileTone) {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(IconTile);
    fixture.componentRef.setInput('icon', 'paw');
    if (tone) {
      fixture.componentRef.setInput('tone', tone);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('o tom neutro usa bg-inset e text-foreground', () => {
    const el = render();
    expect(el.classList).toContain('bg-inset');
    expect(el.classList).toContain('text-foreground');
    expect(el.classList).toContain('size-10');
    expect(el.classList).toContain('rounded-md');
  });

  for (const tone of ['success', 'warning', 'danger'] as const) {
    it(`o tom ${tone} usa bg-${tone}-soft e text-${tone}-foreground`, () => {
      const el = render(tone);
      expect(el.classList).toContain(`bg-${tone}-soft`);
      expect(el.classList).toContain(`text-${tone}-foreground`);
    });
  }

  it('o ícone é decorativo (aria-hidden)', () => {
    const icon = render().querySelector('ng-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
