import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ThemeService } from '@/core/theme/theme.service';

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

describe('TutorShell · tema', () => {
  const original = window.matchMedia;

  /** Controla o `matchMedia` em vez de depender do ambiente. */
  function stubSystem(dark: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: dark,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }

  beforeEach(() => {
    stubSystem(false);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: original });
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.classList.remove('dark'));
  });

  const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
  const create = () => {
    const fixture = TestBed.createComponent(TutorShell);
    fixture.detectChanges();
    return fixture;
  };

  it('o hospedeiro ganha e perde a classe dark conforme o serviço', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('light');
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('dark')).toBe(false);
    theme.setPreference('dark');
    fixture.detectChanges();
    expect(host.classList.contains('dark')).toBe(true);
    theme.setPreference('light');
    fixture.detectChanges();
    expect(host.classList.contains('dark')).toBe(false);
  });

  it('com "system" e o sistema escuro, o hospedeiro é escuro', () => {
    stubSystem(true);
    TestBed.inject(ThemeService).setPreference('system');
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).classList.contains('dark')).toBe(true);
  });

  it('document.documentElement e document.body nunca recebem a classe dark', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('dark');
    const fixture = create();
    fixture.detectChanges();
    expect((document.documentElement.getAttribute('class') ?? '').split(' ').includes('dark')).toBe(false);
    expect((document.body.getAttribute('class') ?? '').split(' ').includes('dark')).toBe(false);
    fixture.destroy();
    expect((document.documentElement.getAttribute('class') ?? '').split(' ').includes('dark')).toBe(false);
    expect((document.body.getAttribute('class') ?? '').split(' ').includes('dark')).toBe(false);
  });

  it('o logo do menu lateral usa as letras brancas no escuro e as navy no claro', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('light');
    const fixture = create();
    const logo = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="tutor-shell-sidebar"] img') as HTMLImageElement;
    const claro = logo().getAttribute('src');
    theme.setPreference('dark');
    fixture.detectChanges();
    expect(logo().getAttribute('src')).not.toBe(claro);
    expect(logo().getAttribute('src')).toBe('/logos/logo-full-dark.svg');
  });

  it('o contêiner de overlays ganha dark no escuro, perde ao voltar ao claro e ao destruir a casca', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('dark');
    const fixture = create();
    expect(overlay().classList.contains('dark')).toBe(true);
    theme.setPreference('light');
    fixture.detectChanges();
    expect(overlay().classList.contains('dark')).toBe(false);
    theme.setPreference('dark');
    fixture.detectChanges();
    expect(overlay().classList.contains('dark')).toBe(true);
    fixture.destroy();
    expect(overlay().classList.contains('dark')).toBe(false);
  });
});
