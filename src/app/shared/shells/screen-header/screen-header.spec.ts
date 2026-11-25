import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ScreenHeader } from './screen-header';

describe('ScreenHeader', () => {
  function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ScreenHeader);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }
  const back = (el: HTMLElement) => el.querySelector('[data-testid="screen-header-back"]');

  it('mostra o título como h1', () => {
    const el = render({ title: 'Dados do pet' }).nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Dados do pet');
  });

  it('sem back não há botão', () => {
    expect(back(render({ title: 'X' }).nativeElement)).toBeNull();
  });

  it('back="back" mostra o botão com aria-label "Voltar"', () => {
    expect(back(render({ title: 'X', back: 'back' }).nativeElement)?.getAttribute('aria-label')).toBe('Voltar');
  });

  it('back="close" mostra o botão com aria-label "Fechar"', () => {
    expect(back(render({ title: 'X', back: 'close' }).nativeElement)?.getAttribute('aria-label')).toBe('Fechar');
  });

  it('sem backLink o clique emite backClick', () => {
    const fixture = render({ title: 'X', back: 'back' });
    let clicks = 0;
    fixture.componentInstance.backClick.subscribe(() => clicks++);
    (back(fixture.nativeElement) as HTMLButtonElement).click();
    expect(clicks).toBe(1);
  });

  it('com backLink o botão é um link', () => {
    expect(back(render({ title: 'X', back: 'back', backLink: '/app' }).nativeElement)?.tagName).toBe('A');
  });
});
