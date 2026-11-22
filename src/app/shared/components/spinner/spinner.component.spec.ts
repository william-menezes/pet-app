import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { ZardSpinnerComponent } from './spinner.component';

describe('ZardSpinnerComponent', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardSpinnerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('anuncia como status, com nome acessível em português', () => {
    const el = render();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-label')).toBe('Carregando');
  });

  it('gira o ícone loader em text-foreground', () => {
    const icon = render().querySelector('ng-icon') as HTMLElement;
    expect(icon.classList).toContain('animate-spin');
    expect(icon.classList).toContain('text-foreground');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });
});
