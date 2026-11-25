import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ThemeService } from '@/core/theme/theme.service';

import { AccountService } from '../../../core/account/account.service';
import { Account, AccountStore } from '../../../core/account/account.store';
import { AccountHome } from './account-home';

const ACCOUNT: Account = {
  id: 'u1',
  nome: 'Ana Souza',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: '+5511987654421',
  celularConfirmadoEm: '2026-11-21T12:03:00Z',
  celularPendente: null,
  termosAceitosEm: '2026-11-21T11:58:00Z',
  termosVersao: '2026-11',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:58:00Z',
};

describe('AccountHome', () => {
  let fixture: ComponentFixture<AccountHome>;
  let el: HTMLElement;
  let store: AccountStore;
  let ensureLoaded: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let preference: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(opts: { account?: Account | null; load?: () => Promise<Account | null>; theme?: string } = {}) {
    const account = opts.account === undefined ? ACCOUNT : opts.account;
    ensureLoaded = vi.fn(opts.load ?? (() => Promise.resolve(account)));
    logout = vi.fn().mockResolvedValue(undefined);
    preference = vi.fn().mockReturnValue(opts.theme ?? 'system');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AccountService, useValue: { ensureLoaded, logout } },
        { provide: ThemeService, useValue: { preference } },
      ],
    });
    store = TestBed.inject(AccountStore);
    if (account) store.set(account);
    fixture = TestBed.createComponent(AccountHome);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  it('mostra o nome, o e-mail e as cinco linhas com os data-testid do contrato', async () => {
    await create();
    expect(byId('account-name')?.textContent).toBe('Ana Souza');
    expect(byId('account-email')?.textContent).toBe('ana@email.com');
    const rows: [string, string][] = [
      ['account-row-personal', '/app/conta/dados'],
      ['account-row-phone', '/app/conta/celular'],
      ['account-row-password', '/app/conta/senha'],
      ['account-row-appearance', '/app/conta/aparencia'],
      ['account-row-privacy', '/app/conta/privacidade'],
    ];
    for (const [id, href] of rows) {
      expect(byId(id)?.getAttribute('href'), id).toBe(href);
    }
    expect(el.querySelector('h1')?.textContent).toContain('Conta');
    expect(byId('account-logout')).not.toBeNull();
  });

  it('chama ensureLoaded ao abrir', async () => {
    await create();
    expect(ensureLoaded).toHaveBeenCalledTimes(1);
  });

  describe('selo do celular', () => {
    it('celular confirmado: número formatado e selo "Confirmado"', async () => {
      await create();
      expect(byId('account-row-phone')?.textContent).toContain('(11) 98765-4421');
      expect(byId('account-phone-badge')?.textContent?.trim()).toBe('Confirmado');
      expect(byId('account-phone-badge')?.getAttribute('data-variant')).toBe('success');
    });

    it('celular ainda não confirmado: selo neutro "Não confirmado" e o número pendente', async () => {
      await create({
        account: { ...ACCOUNT, celular: null, celularConfirmadoEm: null, celularPendente: '+5511912345678' },
      });
      expect(byId('account-phone-badge')?.textContent?.trim()).toBe('Não confirmado');
      expect(byId('account-phone-badge')?.getAttribute('data-variant')).toBe('neutral');
      expect(byId('account-row-phone')?.textContent).toContain('(11) 91234-5678');
    });

    it('sem nenhum número: "Nenhum número cadastrado" e selo "Não confirmado"', async () => {
      await create({ account: { ...ACCOUNT, celular: null, celularConfirmadoEm: null, celularPendente: null } });
      expect(byId('account-row-phone')?.textContent).toContain('Nenhum número cadastrado');
      expect(byId('account-phone-badge')?.textContent?.trim()).toBe('Não confirmado');
    });
  });

  describe('subtítulo da aparência', () => {
    for (const [value, text] of [
      ['light', 'Clara'],
      ['dark', 'Escura'],
      ['system', 'Igual ao sistema'],
    ] as const) {
      it(`${value} mostra "${text}"`, async () => {
        await create({ theme: value });
        expect(byId('account-row-appearance')?.textContent).toContain(text);
      });
    }
  });

  describe('Sair', () => {
    it('chama AccountService.logout()', async () => {
      await create();
      byId('account-logout')!.click();
      await settle();
      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('um segundo clique durante a saída não chama de novo', async () => {
      await create();
      let finish!: () => void;
      logout.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      byId('account-logout')!.click();
      byId('account-logout')!.click();
      expect(logout).toHaveBeenCalledTimes(1);
      finish();
      await settle();
    });
  });

  describe('sem a conta carregada', () => {
    it('carregando: mostra o esqueleto e nenhuma linha', async () => {
      let finish!: (value: Account | null) => void;
      await create({ account: null, load: () => new Promise((resolve) => (finish = resolve)) });
      expect(byId('account-loading')).not.toBeNull();
      expect(byId('account-row-personal')).toBeNull();
      finish(null);
      await settle();
    });

    it('falha ao carregar: aviso e "Tentar de novo", que carrega de novo; "Sair" continua disponível', async () => {
      await create({ account: null, load: () => Promise.resolve(null) });
      expect(byId('account-load-error')?.textContent).toContain('Não conseguimos carregar sua conta');
      expect(byId('account-logout')).not.toBeNull();
      expect(byId('account-row-personal')).toBeNull();

      ensureLoaded.mockImplementation(() => {
        store.set(ACCOUNT);
        return Promise.resolve(ACCOUNT);
      });
      byId('account-retry')!.click();
      await settle();
      expect(ensureLoaded).toHaveBeenCalledTimes(2);
      expect(byId('account-name')?.textContent).toBe('Ana Souza');
      expect(byId('account-load-error')).toBeNull();
    });
  });

  it('tem os links para os termos e a política', async () => {
    await create();
    expect(byId('account-terms-link')?.getAttribute('href')).toBe('/legal/termos');
    expect(byId('account-privacy-policy-link')?.getAttribute('href')).toBe('/legal/privacidade');
  });
});
