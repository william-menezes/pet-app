import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { ContingencyView } from '../contingency-view/contingency-view';
import { NotFoundView } from './not-found-view';

function html(subject: 'tag' | 'page'): string {
  TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
  const fixture = TestBed.createComponent(NotFoundView);
  fixture.componentRef.setInput('subject', subject);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).innerHTML;
}

describe('NotFoundView (T032)', () => {
  it('renderiza título, texto, cartão e o link "Conhecer o Faro"', () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(NotFoundView);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="public-notice-title"]')?.textContent).toContain('Não encontramos esta tag.');
    expect(el.textContent).toContain('microchip');
    const home = el.querySelector<HTMLAnchorElement>('[data-testid="public-not-found-home"]');
    expect(home?.tagName).toBe('A');
    expect(home?.getAttribute('href')).toBe('/');
  });

  it('a tela de uma tag inexistente é a mesma para qualquer causa: o HTML não depende de nada que varie', () => {
    const first = html('tag');
    TestBed.resetTestingModule();
    const second = html('tag');
    expect(first).toBe(second);
  });

  it('o `**` do app usa a mesma tela, só com o título falando de "página"', () => {
    expect(html('page')).toContain('Não encontramos esta página.');
    TestBed.resetTestingModule();
    expect(html('tag')).not.toContain('Não encontramos esta página.');
  });
});

describe('ContingencyView (T032)', () => {
  it('renderiza "Este pet tem dono" com "Tentar de novo" como link comum', () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ContingencyView);
    fixture.componentRef.setInput('retryHref', '/7K3MQ9XAC');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="public-notice-title"]')?.textContent).toContain('Este pet tem dono.');
    const retry = el.querySelector<HTMLAnchorElement>('[data-testid="public-contingency-retry"]');
    expect(retry?.tagName).toBe('A');
    expect(retry?.getAttribute('href')).toBe('/7K3MQ9XAC');
    expect(el.textContent).toContain('microchip');
  });
});
