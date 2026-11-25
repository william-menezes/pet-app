import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { Note } from './note';

@Component({
  imports: [Note],
  template: `<app-note icon="info">Você pode mudar isso depois.</app-note>`,
})
class Host {}

describe('Note', () => {
  it('projeta o texto, em cinza, com o ícone decorativo', () => {
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const note = el.querySelector('app-note') as HTMLElement;
    expect(note.textContent).toContain('Você pode mudar isso depois.');
    expect(note.classList).toContain('text-muted-foreground');
    expect(note.classList).toContain('text-[13px]');
    expect(el.querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
