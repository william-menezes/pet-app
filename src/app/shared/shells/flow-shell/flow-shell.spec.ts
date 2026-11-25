import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FlowShell } from './flow-shell';

@Component({
  imports: [FlowShell],
  template: `
    <app-flow-shell barTitle="Ativar tag" back="back" [step]="step">
      <p data-testid="host-body">Corpo</p>
      <button footer type="button" data-testid="host-action">Continuar</button>
    </app-flow-shell>
  `,
})
class HostWithStep {
  step: { current: number; total: number } | null = { current: 1, total: 3 };
}

describe('FlowShell', () => {
  function render(step: { current: number; total: number } | null = { current: 1, total: 3 }) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostWithStep);
    fixture.componentInstance.step = step;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const byId = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('projeta o corpo e as ações em [footer]', () => {
    const el = render();
    expect(byId(el, 'host-body')?.closest('main')).not.toBeNull();
    expect(byId(el, 'flow-shell-footer')?.contains(byId(el, 'host-action'))).toBe(true);
  });

  it('com step mostra app-steps ("Passo 1 de 3")', () => {
    const el = render({ current: 1, total: 3 });
    expect(el.querySelector('app-steps')).not.toBeNull();
    expect(byId(el, 'steps-text')?.textContent?.trim()).toBe('Passo 1 de 3');
  });

  it('sem step não mostra app-steps', () => {
    expect(render(null).querySelector('app-steps')).toBeNull();
  });

  it('o painel de marca tem data-testid="flow-shell-brand-panel"', () => {
    expect(byId(render(), 'flow-shell-brand-panel')).not.toBeNull();
  });

  it('o botão de voltar tem aria-label "Voltar" e o nome do fluxo aparece', () => {
    const el = render();
    expect(byId(el, 'flow-shell-back')?.getAttribute('aria-label')).toBe('Voltar');
    expect(byId(el, 'flow-shell-bar-title')?.textContent?.trim()).toBe('Ativar tag');
  });
});
