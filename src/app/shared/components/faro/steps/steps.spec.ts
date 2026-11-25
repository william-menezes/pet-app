import { TestBed } from '@angular/core/testing';

import { Steps } from './steps';

describe('Steps', () => {
  function render(current: number, total: number): HTMLElement {
    const fixture = TestBed.createComponent(Steps);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('com current=2 e total=3 desenha duas barras bg-foreground e uma bg-border', () => {
    const bars = Array.from(render(2, 3).querySelectorAll('[data-testid="steps-bar"]'));
    expect(bars.length).toBe(3);
    expect(bars.map((b) => b.classList.contains('bg-foreground'))).toEqual([true, true, false]);
    expect(bars.map((b) => b.classList.contains('bg-border'))).toEqual([false, false, true]);
  });

  it('o texto é "Passo 2 de 3"', () => {
    expect(render(2, 3).querySelector('[data-testid="steps-text"]')?.textContent?.trim()).toBe('Passo 2 de 3');
  });

  it('as barras são decorativas (aria-hidden) e nunca lima', () => {
    const el = render(1, 4);
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(el.innerHTML).not.toContain('bg-primary');
  });
});
