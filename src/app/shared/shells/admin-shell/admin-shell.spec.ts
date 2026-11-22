import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AdminShell } from './admin-shell';

@Component({ template: '' })
class Empty {}

describe('AdminShell', () => {
  async function render(url = '/admin') {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'admin', component: Empty }, { path: 'admin/fila', component: Empty }])],
    });
    const fixture = TestBed.createComponent(AdminShell);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const byId = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('tem a barra do topo e o menu lateral, cada um com uma navegação do admin', async () => {
    const el = await render();
    expect(byId(el, 'admin-shell-topbar')?.querySelector('nav[aria-label="Navegação do admin"]')).not.toBeNull();
    expect(byId(el, 'admin-shell-sidebar')?.querySelector('nav[aria-label="Navegação do admin"]')).not.toBeNull();
  });

  it('mostra o selo "Admin" nas duas navegações', async () => {
    const el = await render();
    for (const id of ['admin-shell-topbar', 'admin-shell-sidebar']) {
      expect(byId(el, id)?.textContent).toContain('Admin');
    }
  });

  it('tem os quatro itens admin-nav-<id> em cada navegação', async () => {
    const el = await render();
    for (const id of ['admin-shell-topbar', 'admin-shell-sidebar']) {
      const nav = byId(el, id) as HTMLElement;
      for (const item of ['lotes', 'codigos', 'fila', 'auditoria']) {
        expect(nav.querySelector(`[data-testid="admin-nav-${item}"]`), `${id} ${item}`).not.toBeNull();
      }
    }
  });

  it('o item atual tem aria-current="page" e tinta', async () => {
    const el = await render('/admin/fila');
    const fila = byId(el, 'admin-shell-sidebar')?.querySelector('[data-testid="admin-nav-fila"]') as HTMLElement;
    const lotes = byId(el, 'admin-shell-sidebar')?.querySelector('[data-testid="admin-nav-lotes"]') as HTMLElement;
    expect(fila.getAttribute('aria-current')).toBe('page');
    expect(fila.className).toContain('bg-foreground');
    expect(lotes.getAttribute('aria-current')).toBeNull();
  });

  it('o conteúdo fica num <main id="conteudo">', async () => {
    expect(byId(await render(), 'admin-shell-main')?.id).toBe('conteudo');
  });
});
