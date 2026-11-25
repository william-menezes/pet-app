import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';

import { faroIcons } from '@/shared/icons/faro-icons';

import { PetHero } from './pet-hero';

describe('PetHero', () => {
  function render(inputs: Record<string, string | boolean | null>): HTMLElement {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIcons(faroIcons)] });
    const fixture = TestBed.createComponent(PetHero);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sem foto: ícone paw, sem véu, e nome e subtítulo em text-foreground', () => {
    const el = render({ name: 'Paçoca', subtitle: 'Tag ativa · 7K3M-Q9XA-C' });
    expect(el.querySelector('[data-testid="pet-hero-paw"] ng-icon')).not.toBeNull();
    expect(el.querySelector('[data-testid="pet-hero-photo"]')).toBeNull();
    expect(el.querySelector('[data-testid="pet-hero-veil"]')).toBeNull();
    expect(el.querySelector('[data-testid="pet-hero-name"]')?.classList.contains('text-foreground')).toBe(true);
    expect(el.querySelector('[data-testid="pet-hero-subtitle"]')?.classList.contains('text-foreground')).toBe(true);
  });

  it('sem foto o fundo é bg-photo e o ícone é decorativo', () => {
    const el = render({ name: 'Paçoca' });
    expect(el.classList.contains('bg-photo')).toBe(true);
    expect(el.classList.contains('rounded-2xl')).toBe(true);
    expect(el.querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('com foto: imagem, véu na base e nome e subtítulo em branco', () => {
    const el = render({ name: 'Paçoca', subtitle: 'Tag ativa', photoUrl: 'https://exemplo.test/foto.jpg', alt: 'Paçoca no sofá' });
    const img = el.querySelector('[data-testid="pet-hero-photo"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://exemplo.test/foto.jpg');
    expect(img.getAttribute('alt')).toBe('Paçoca no sofá');
    expect(img.getAttribute('width')).not.toBeNull();
    expect(img.getAttribute('height')).not.toBeNull();
    expect(el.querySelector('[data-testid="pet-hero-veil"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="pet-hero-name"]')?.classList.contains('text-white')).toBe(true);
    expect(el.querySelector('[data-testid="pet-hero-subtitle"]')?.classList.contains('text-white')).toBe(true);
  });

  it('priority liga fetchpriority="high" e loading="eager"; sem ele a imagem é preguiçosa', () => {
    const prio = render({ name: 'A', photoUrl: 'x.jpg', priority: true }).querySelector('img') as HTMLImageElement;
    expect(prio.getAttribute('fetchpriority')).toBe('high');
    expect(prio.getAttribute('loading')).toBe('eager');
    const lazy = render({ name: 'A', photoUrl: 'x.jpg' }).querySelector('img') as HTMLImageElement;
    expect(lazy.getAttribute('fetchpriority')).toBeNull();
    expect(lazy.getAttribute('loading')).toBe('lazy');
  });

  it('o nome é h1 por padrão, h2 quando a tela já tem o h1 e só texto escondido do leitor quando é o título da tela', () => {
    const tag = (heading?: string) =>
      render(heading === undefined ? { name: 'Paçoca' } : { name: 'Paçoca', heading }).querySelector('[data-testid="pet-hero-name"]') as HTMLElement;
    expect(tag().tagName).toBe('H1');
    expect(tag('h2').tagName).toBe('H2');
    const none = tag('none');
    expect(none.tagName).toBe('P');
    expect(none.getAttribute('aria-hidden')).toBe('true');
    expect(none.textContent).toContain('Paçoca');
    expect(none.classList.contains('font-display')).toBe(true);
  });

  it('o nome usa a receita Display', () => {
    const name = render({ name: 'Paçoca' }).querySelector('[data-testid="pet-hero-name"]') as HTMLElement;
    for (const cls of ['font-display', 'font-bold', 'leading-none', 'text-[36px]', 'md:text-[48px]', 'xl:text-[56px]']) {
      expect(name.classList.contains(cls), cls).toBe(true);
    }
  });
});
