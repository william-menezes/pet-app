import { TestBed } from '@angular/core/testing';

import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  function render(size?: 44 | 52 | 56): HTMLElement {
    const fixture = TestBed.createComponent(BrandMark);
    if (size) {
      fixture.componentRef.setInput('size', size);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('é um círculo branco de 44px por padrão, com o focinho lima nomeado', () => {
    const el = render();
    for (const cls of ['rounded-full', 'bg-white', 'size-11', 'items-center', 'justify-center']) {
      expect(el.classList.contains(cls), cls).toBe(true);
    }
    const focinho = el.querySelector('app-focinho') as HTMLElement;
    expect(focinho.classList.contains('text-primary')).toBe(true);
    expect(focinho.classList.contains('w-[60%]')).toBe(true);
    expect(focinho.querySelector('svg')?.getAttribute('aria-label')).toBe('Faro');
  });

  it('aceita 52 e 56', () => {
    expect(render(52).classList.contains('size-[52px]')).toBe(true);
    expect(render(56).classList.contains('size-14')).toBe(true);
  });
});
