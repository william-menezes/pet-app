import { Type, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrivacyPolicy } from './privacy-policy/privacy-policy';
import { Terms } from './terms/terms';

describe('Páginas legais', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  const casos: [string, Type<unknown>, string][] = [
    ['Termos de uso', Terms, 'Termos de uso'],
    ['Política de privacidade', PrivacyPolicy, 'Política de privacidade'],
  ];
  for (const [nome, componente, titulo] of casos) {
    it(`${nome}: mostra o título e o aviso de rascunho`, async () => {
      const fixture = TestBed.createComponent(componente);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="legal-title"]')?.textContent?.trim()).toBe(titulo);
      expect(el.querySelector('[data-testid="legal-draft-notice"]')?.textContent).toContain(
        'Rascunho. Texto final em preparação.',
      );
    });
  }
});
