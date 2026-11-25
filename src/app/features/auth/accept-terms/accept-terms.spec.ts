import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore, type Account } from '../../../core/account/account.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { AcceptTerms } from './accept-terms';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: null,
  celularConfirmadoEm: null,
  celularPendente: null,
  termosAceitosEm: null,
  termosVersao: null,
  temSenha: false,
  provedores: ['google'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

describe('AcceptTerms', () => {
  let fixture: ComponentFixture<AcceptTerms>;
  let el: HTMLElement;
  let acceptTerms: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;
  let capture: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const accept = () => byId('terms-accept') as HTMLButtonElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(opts: { account?: Account | null; query?: Record<string, string> } = {}) {
    acceptTerms = vi.fn().mockResolvedValue({ ok: true });
    logout = vi.fn().mockResolvedValue(undefined);
    go = vi.fn().mockResolvedValue(true);
    capture = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(opts.query ?? {}) } },
        },
        {
          provide: AccountService,
          useValue: { ensureLoaded: vi.fn().mockResolvedValue(null), acceptTerms, logout },
        },
        { provide: PostAuthNavigator, useValue: { go } },
        { provide: ReturnUrlService, useValue: { capture } },
      ],
    });
    const store = TestBed.inject(AccountStore);
    const acc = opts.account === undefined ? account() : opts.account;
    if (acc) store.set(acc);
    fixture = TestBed.createComponent(AcceptTerms);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  async function tick() {
    el.querySelector<HTMLInputElement>('[data-testid="terms-checkbox"] input')!.click();
    await settle();
  }

  it('tem os data-testid do contrato e os dois links, que abrem em nova aba', async () => {
    await create();
    for (const id of ['terms-checkbox', 'terms-accept', 'terms-logout']) {
      expect(byId(id), id).not.toBeNull();
    }
    const hrefs = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-testid="terms-checkbox"] a'));
    expect(hrefs.map((a) => a.getAttribute('href'))).toEqual(['/legal/termos', '/legal/privacidade']);
    expect(hrefs.every((a) => a.target === '_blank' && a.rel.includes('noopener'))).toBe(true);
  });

  it('mostra a conta do Google com o ícone oficial e o e-mail', async () => {
    await create();
    const card = byId('terms-account')!;
    expect(card.textContent).toContain('Você entrou com o Google');
    expect(card.textContent).toContain('ana@email.com');
    expect(card.querySelector('app-google-glyph')).not.toBeNull();
  });

  it('conta sem Google mostra só o e-mail, sem o ícone', async () => {
    await create({ account: account({ provedores: ['email'], temSenha: true }) });
    const card = byId('terms-account')!;
    expect(card.textContent).toContain('ana@email.com');
    expect(card.querySelector('app-google-glyph')).toBeNull();
  });

  it('o botão "Aceitar e continuar" começa desabilitado e habilita com a caixa', async () => {
    await create();
    expect(accept().disabled).toBe(true);
    await tick();
    expect(accept().disabled).toBe(false);
    await tick();
    expect(accept().disabled).toBe(true);
  });

  it('clicar desabilitado não aceita nada', async () => {
    await create();
    await (async () => {
      accept().click();
      await settle();
    })();
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it('aceitar chama acceptTerms() e depois PostAuthNavigator.go()', async () => {
    await create();
    await tick();
    accept().click();
    await settle();
    await settle();
    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledTimes(1);
    expect(byId('terms-error')).toBeNull();
  });

  it('falha de rede mostra a mensagem, não navega e reabilita o botão', async () => {
    await create();
    acceptTerms.mockResolvedValue({ ok: false, reason: 'network' });
    await tick();
    accept().click();
    await settle();
    await settle();
    expect(byId('terms-error')?.textContent).toContain('Não conseguimos conectar. Verifique sua conexão e tente de novo.');
    expect(go).not.toHaveBeenCalled();
    expect(accept().disabled).toBe(false);
  });

  it('"Sair" chama AccountService.logout()', async () => {
    await create();
    byId('terms-logout')!.click();
    await settle();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('guarda o returnUrl da URL (só se válido)', async () => {
    await create({ query: { returnUrl: '/ativar/7K3M-Q9XA-C' } });
    expect(capture).toHaveBeenCalledWith('/ativar/7K3M-Q9XA-C');
  });

  it('a região de erros é aria-live="polite"', async () => {
    await create();
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
