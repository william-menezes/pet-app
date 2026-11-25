import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ReturnUrlService } from '../../../core/auth/return-url';
import { Welcome } from './welcome';

describe('Welcome', () => {
  let fixture: ComponentFixture<Welcome>;
  let capture: ReturnType<typeof vi.fn>;

  async function create(query: Record<string, string> = {}) {
    capture = vi.fn();
    const params = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ReturnUrlService, useValue: { capture } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      ],
    });
    fixture = TestBed.createComponent(Welcome);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const link = (el: HTMLElement, id: string) => el.querySelector<HTMLAnchorElement>(`[data-testid="${id}"]`)!;

  it('mostra os dois botões, o principal para criar conta', async () => {
    const el = await create();
    expect(link(el, 'welcome-create-account').textContent?.trim()).toBe('Criar conta');
    expect(link(el, 'welcome-login').textContent?.trim()).toBe('Já tenho conta');
    expect(link(el, 'welcome-create-account').getAttribute('href')).toBe('/auth/criar-conta');
    expect(link(el, 'welcome-login').getAttribute('href')).toBe('/auth/login');
  });

  it('preserva o returnUrl nos dois links e o guarda no init', async () => {
    const el = await create({ returnUrl: '/ativar/7K3M-Q9XA-C' });
    const encoded = '?returnUrl=%2Fativar%2F7K3M-Q9XA-C';
    expect(link(el, 'welcome-create-account').getAttribute('href')).toBe(`/auth/criar-conta${encoded}`);
    expect(link(el, 'welcome-login').getAttribute('href')).toBe(`/auth/login${encoded}`);
    expect(capture).toHaveBeenCalledWith('/ativar/7K3M-Q9XA-C');
  });

  it('descarta returnUrl inválido dos links', async () => {
    const el = await create({ returnUrl: '//evil.com' });
    expect(link(el, 'welcome-create-account').getAttribute('href')).toBe('/auth/criar-conta');
    expect(link(el, 'welcome-login').getAttribute('href')).toBe('/auth/login');
  });

  it('mostra o aviso de conta excluída só com ?conta=excluida', async () => {
    let el = await create();
    expect(el.querySelector('[data-testid="welcome-deleted-notice"]')).toBeNull();
    TestBed.resetTestingModule();
    el = await create({ conta: 'excluida' });
    expect(el.querySelector('[data-testid="welcome-deleted-notice"]')?.textContent).toContain('Sua conta foi excluída.');
  });

  it('tem o título da tela e esconde a foto quando ela não carrega', async () => {
    const el = await create();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('O caminho de volta para casa.');
    el.querySelector('[data-testid="welcome-photo"]')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="welcome-photo"]')).toBeNull();
  });
});
