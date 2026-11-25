import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ActionCard } from './action-card';

@Component({
  imports: [ActionCard],
  template: `
    <app-action-card title="Ative sua primeira tag">
      Use o PIN do cartão da embalagem.
      <button action type="button" data-testid="host-action">Ativar</button>
    </app-action-card>
  `,
})
class Host {}

@Component({
  imports: [ActionCard],
  template: `<app-action-card title="Sem ação">Só o texto.</app-action-card>`,
})
class HostWithoutAction {}

describe('ActionCard', () => {
  it('o <h2> tem text-primary-foreground (sem a classe ele some no tema escuro)', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const h2 = (fixture.nativeElement as HTMLElement).querySelector('h2') as HTMLElement;
    expect(h2.textContent).toContain('Ative sua primeira tag');
    expect(h2.classList.contains('text-primary-foreground')).toBe(true);
    expect(h2.classList.contains('font-display')).toBe(true);
  });

  it('é um cartão lima com texto de tinta fixa', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('app-action-card') as HTMLElement;
    for (const cls of ['bg-primary', 'text-primary-foreground', 'rounded-2xl', 'p-[18px]']) {
      expect(card.classList.contains(cls), cls).toBe(true);
    }
  });

  it('projeta o texto e a ação', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Use o PIN do cartão da embalagem.');
    expect(el.querySelector('[data-testid="host-action"]')).not.toBeNull();
  });

  it('sem ação, a área da ação fica vazia (e escondida)', () => {
    const fixture = TestBed.createComponent(HostWithoutAction);
    fixture.detectChanges();
    const wrapper = (fixture.nativeElement as HTMLElement).querySelector('.self-start') as HTMLElement;
    expect(wrapper.children.length).toBe(0);
    expect(wrapper.classList.contains('empty:hidden')).toBe(true);
  });
});
