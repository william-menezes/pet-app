import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { ZardAlertComponent } from './alert.component';
import type { ZardAlertTypeVariants } from './alert.variants';

const EXPECTED: Record<ZardAlertTypeVariants, { classes: string[]; role: string }> = {
  neutral: { classes: ['bg-neutral-soft', 'text-neutral-foreground'], role: 'status' },
  success: { classes: ['bg-success-soft', 'text-success-foreground'], role: 'status' },
  danger: { classes: ['bg-danger-soft', 'text-danger-foreground'], role: 'alert' },
};

describe('ZardAlertComponent', () => {
  function render(type?: ZardAlertTypeVariants) {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(ZardAlertComponent);
    if (type) {
      fixture.componentRef.setInput('zType', type);
    }
    fixture.componentRef.setInput('zDescription', 'Texto do aviso');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  for (const [type, expected] of Object.entries(EXPECTED)) {
    it(`tipo "${type}": classes e role "${expected.role}"`, () => {
      const el = render(type as ZardAlertTypeVariants);
      for (const cls of expected.classes) {
        expect(el.classList, cls).toContain(cls);
      }
      expect(el.getAttribute('role')).toBe(expected.role);
    });
  }

  it('o padrão é neutro', () => {
    const el = render();
    expect(el.classList).toContain('bg-neutral-soft');
    expect(el.getAttribute('role')).toBe('status');
  });

  it('não tem borda e usa o raio de 16px', () => {
    const el = render('danger');
    expect(el.classList).toContain('rounded-card-sm');
    expect([...el.classList].some((c) => /^border/.test(c))).toBe(false);
  });

  it('o ícone é decorativo e o texto aparece', () => {
    const el = render('success');
    expect(el.querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.textContent).toContain('Texto do aviso');
  });

  it('não existe tipo âmbar nem azul', () => {
    expect(Object.keys(EXPECTED)).toEqual(['neutral', 'success', 'danger']);
  });
});
