import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { InfoCard } from './info-card';

@Component({
  imports: [InfoCard],
  template: `<app-info-card icon="lock" title="Seus dados">Só o que você liberou aparece.</app-info-card>`,
})
class Host {}

describe('InfoCard', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o título e projeta o texto', () => {
    const el = render();
    expect(el.querySelector('[data-testid="info-card-title"]')?.textContent).toContain('Seus dados');
    expect(el.textContent).toContain('Só o que você liberou aparece.');
  });

  it('é um cartão sem borda e sem sombra', () => {
    const card = render().querySelector('app-info-card') as HTMLElement;
    expect(card.classList).toContain('bg-card');
    expect(card.classList).toContain('rounded-xl');
    expect(card.className).not.toMatch(/\bshadow|\bborder\b/);
  });

  it('o ícone é decorativo', () => {
    expect(render().querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
