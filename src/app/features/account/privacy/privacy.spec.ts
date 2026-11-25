import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Account, AccountStore } from '../../../core/account/account.store';
import { PrivacyService } from '../../../core/account/privacy.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { Privacy } from './privacy';

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

describe('Privacy', () => {
  let fixture: ComponentFixture<Privacy>;
  let el: HTMLElement;
  let exportData: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create() {
    exportData = vi.fn().mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PrivacyService, useValue: { exportData, deleteAccount: vi.fn() } },
        { provide: AuthService, useValue: { signInWithGoogle: vi.fn() } },
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
      ],
    });
    TestBed.inject(AccountStore).set(ACCOUNT);
    fixture = TestBed.createComponent(Privacy);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  afterEach(() => fixture?.destroy());

  it('mostra o cabeçalho com voltar para /app/conta e os dois blocos', async () => {
    await create();
    expect(el.querySelector('h1')?.textContent).toContain('Privacidade');
    expect(el.querySelector('[data-testid="screen-header-back"]')?.getAttribute('href')).toBe('/app/conta');
    expect(el.textContent).toContain('Exportar meus dados');
    expect(el.textContent).toContain('Excluir minha conta');
    expect(byId('account-privacy-export')).not.toBeNull();
    expect(byId('account-privacy-delete')).not.toBeNull();
  });

  it('o botão de excluir é o único em vermelho (tipo danger) e o de exportar é de contorno', async () => {
    await create();
    expect(byId('account-privacy-delete')?.className).toContain('text-danger-foreground');
    expect(byId('account-privacy-export')?.className).not.toContain('danger');
  });

  describe('exportar', () => {
    it('dispara o download uma vez e avisa que o arquivo foi baixado', async () => {
      await create();
      byId('account-privacy-export')!.click();
      await settle();
      expect(exportData).toHaveBeenCalledTimes(1);
      expect(byId('account-privacy-exported')?.textContent).toContain('O arquivo foi baixado');
      expect(byId('account-privacy-export-error')).toBeNull();
    });

    it('rate_limited mostra o tempo que falta e não avisa sucesso', async () => {
      await create();
      exportData.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfterSeconds: 7200 });
      byId('account-privacy-export')!.click();
      await settle();
      expect(byId('account-privacy-export-error')?.textContent).toContain(
        'Você já exportou seus dados 3 vezes hoje. Tente de novo em 2 horas.',
      );
      expect(byId('account-privacy-exported')).toBeNull();
    });

    it('rate_limited sem tempo legível diz "alguns minutos"', async () => {
      await create();
      exportData.mockResolvedValue({ ok: false, reason: 'rate_limited' });
      byId('account-privacy-export')!.click();
      await settle();
      expect(byId('account-privacy-export-error')?.textContent).toContain('em alguns minutos.');
    });

    it('falha de rede mostra o aviso e permite tentar de novo', async () => {
      await create();
      exportData.mockResolvedValueOnce({ ok: false, reason: 'network' });
      byId('account-privacy-export')!.click();
      await settle();
      expect(byId('account-privacy-export-error')?.textContent).toContain('Não conseguimos gerar o arquivo agora');
      byId('account-privacy-export')!.click();
      await settle();
      expect(exportData).toHaveBeenCalledTimes(2);
      expect(byId('account-privacy-export-error')).toBeNull();
      expect(byId('account-privacy-exported')).not.toBeNull();
    });

    it('um segundo clique durante a geração não baixa duas vezes', async () => {
      await create();
      let finish!: (value: unknown) => void;
      exportData.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      byId('account-privacy-export')!.click();
      byId('account-privacy-export')!.click();
      expect(exportData).toHaveBeenCalledTimes(1);
      finish({ ok: true });
      await settle();
    });
  });

  it('"Excluir minha conta" abre o diálogo de confirmação', async () => {
    await create();
    expect(document.querySelector('[data-testid="account-delete-submit"]')).toBeNull();
    byId('account-privacy-delete')!.click();
    await settle();
    expect(document.querySelector('[data-testid="account-delete-submit"]')).not.toBeNull();
    (document.querySelector('[data-testid="account-delete-cancel"]') as HTMLElement).click();
    await settle();
  });
});
