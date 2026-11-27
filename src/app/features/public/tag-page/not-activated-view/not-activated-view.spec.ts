import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';
import { NotActivatedView } from './not-activated-view';

function render(code: string) {
  TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
  const fixture = TestBed.createComponent(NotActivatedView);
  fixture.componentRef.setInput('code', code);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return (id: string) => el.querySelector<HTMLAnchorElement>(`[data-testid="${id}"]`);
}

describe('NotActivatedView (T033)', () => {
  it('"Ativar minha tag" leva a /ativar/<código normalizado> (9 caracteres, sem hífen)', () => {
    const byId = render('7K3M-Q9XA-C');
    const link = byId('public-not-activated-activate');
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe('/ativar/7K3MQ9XAC');
  });

  it('mostra o código na forma de exibição e "Entrar" volta para a ativação', () => {
    const byId = render('7K3M-Q9XA-C');
    expect(byId('public-not-activated-code')?.textContent).toContain('7K3M-Q9XA-C');
    expect(byId('public-not-activated-login')?.getAttribute('href')).toBe('/auth/login?returnUrl=%2Fativar%2F7K3MQ9XAC');
  });

  it('o texto pede o PIN que veio no cartão da embalagem', () => {
    const byId = render('7K3M-Q9XA-C');
    expect(byId('public-notice-body')?.textContent).toContain('PIN que veio no cartão da embalagem');
    expect(byId('public-notice-title')?.textContent).toContain('Esta tag ainda não foi ativada.');
  });
});
