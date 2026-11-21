import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { TutorShell } from './tutor-shell';

@Component({ template: '' })
class Empty {}

describe('TutorShell', () => {
  async function render(inputs: Record<string, unknown> = {}, url = '/app') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app', component: Empty },
          { path: 'app/pets', component: Empty },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(TutorShell);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const byId = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('tem três navegações com o nome "Navegação principal" quando a barra inferior está ligada', async () => {
    const el = await render({ bottomNav: true });
    expect(el.querySelectorAll('nav[aria-label="Navegação principal"]').length).toBe(3);
  });

  it('com bottomNav=false não existe a barra inferior', async () => {
    const el = await render({ bottomNav: false });
    expect(byId(el, 'tutor-shell-bottom-nav')).toBeNull();
    expect(byId(el, 'tutor-shell-rail')).not.toBeNull();
    expect(byId(el, 'tutor-shell-sidebar')).not.toBeNull();
  });

  it('com bottomNav=true a barra inferior existe e o conteúdo reserva espaço para ela', async () => {
    const el = await render({ bottomNav: true });
    expect(byId(el, 'tutor-shell-bottom-nav')).not.toBeNull();
    expect(byId(el, 'tutor-shell-main')?.className).toContain('pb-[104px]');
  });

  it('a inicial do nome aparece em tutor-shell-user', async () => {
    const el = await render({ userName: 'ana', userEmail: 'ana@email.com' });
    const user = byId(el, 'tutor-shell-user');
    expect(user?.textContent).toContain('A');
    expect(user?.textContent).toContain('ana@email.com');
  });

  it('o item da rota atual tem aria-current="page" e tinta; os outros não', async () => {
    const el = await render({ bottomNav: true }, '/app/pets');
    const sidebar = byId(el, 'tutor-shell-sidebar') as HTMLElement;
    const pets = sidebar.querySelector('[data-testid="tutor-nav-pets"]') as HTMLElement;
    const inicio = sidebar.querySelector('[data-testid="tutor-nav-inicio"]') as HTMLElement;
    expect(pets.getAttribute('aria-current')).toBe('page');
    expect(pets.className).toContain('bg-foreground');
    expect(pets.className).toContain('text-background');
    expect(inicio.getAttribute('aria-current')).toBeNull();
  });

  it('o item "Início" é exato: não fica ativo em /app/pets', async () => {
    const el = await render({}, '/app/pets');
    expect(byId(el, 'tutor-shell-rail')?.querySelector('[data-testid="tutor-nav-inicio"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('o atalho "Pular para o conteúdo" leva o foco para #conteudo sem navegar', async () => {
    const el = await render();
    document.body.appendChild(el);
    (byId(el, 'tutor-shell-skip') as HTMLAnchorElement).click();
    expect(document.activeElement?.id).toBe('conteudo');
    el.remove();
  });

  it('o conteúdo fica num <main id="conteudo" tabindex="-1">', async () => {
    const main = byId(await render(), 'tutor-shell-main');
    expect(main?.tagName).toBe('MAIN');
    expect(main?.id).toBe('conteudo');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });
});
