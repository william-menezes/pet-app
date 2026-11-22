import { OverlayContainer } from '@angular/cdk/overlay';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Account, AccountStore } from '../../../core/account/account.store';
import { PrivacyService } from '../../../core/account/privacy.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { DeleteAccountDialog } from './delete-account-dialog';

const PASSWORD_ACCOUNT: Account = {
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
const GOOGLE_ACCOUNT: Account = { ...PASSWORD_ACCOUNT, temSenha: false, provedores: ['google'] };

describe('DeleteAccountDialog', () => {
  let fixture: ComponentFixture<DeleteAccountDialog>;
  let deleteAccount: ReturnType<typeof vi.fn>;
  let signInWithGoogle: ReturnType<typeof vi.fn>;
  let capture: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  // O diálogo vive no contêiner de overlays do CDK, fora do `fixture.nativeElement`.
  const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const submit = () => byId('account-delete-submit') as HTMLButtonElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(account: Account) {
    deleteAccount = vi.fn().mockResolvedValue({ ok: true });
    signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    capture = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PrivacyService, useValue: { deleteAccount } },
        { provide: AuthService, useValue: { signInWithGoogle } },
        { provide: ReturnUrlService, useValue: { capture } },
      ],
    });
    TestBed.inject(AccountStore).set(account);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DeleteAccountDialog);
    fixture.detectChanges();
    await settle();
  }

  async function open() {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await settle();
  }

  async function type(testId: string, value: string) {
    const input = byId(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function click(testId: string) {
    byId(testId)!.click();
    await settle();
  }

  afterEach(() => {
    fixture?.destroy();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('fechado, não mostra nada', async () => {
    await create(PASSWORD_ACCOUNT);
    expect(byId('account-delete-submit')).toBeNull();
  });

  it('aberto, mostra o título, o campo EXCLUIR e os botões; o destrutivo começa desabilitado', async () => {
    await create(PASSWORD_ACCOUNT);
    await open();
    expect(document.body.textContent).toContain('Excluir sua conta?');
    expect(byId('account-delete-confirm-text')).not.toBeNull();
    expect(byId('account-delete-cancel')).not.toBeNull();
    expect(submit().textContent).toContain('Excluir definitivamente');
    expect(submit().disabled).toBe(true);
  });

  describe('botão destrutivo', () => {
    it('com senha: só habilita com EXCLUIR e a senha preenchida', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      await type('account-delete-confirm-text', 'EXCLUI');
      await type('account-delete-password', 'SenhaSegura1');
      expect(submit().disabled).toBe(true);
      await type('account-delete-confirm-text', 'excluir');
      expect(submit().disabled).toBe(true);
      await type('account-delete-confirm-text', 'EXCLUIR');
      expect(submit().disabled).toBe(false);
      await type('account-delete-password', '');
      expect(submit().disabled).toBe(true);
    });

    it('conta só com o Google: habilita só com EXCLUIR, sem campo de senha, e mostra o aviso', async () => {
      await create(GOOGLE_ACCOUNT);
      await open();
      expect(byId('account-delete-password')).toBeNull();
      expect(byId('account-delete-google-note')).not.toBeNull();
      expect(byId('account-delete-google-reauth')).toBeNull();
      await type('account-delete-confirm-text', 'EXCLUIR');
      expect(submit().disabled).toBe(false);
    });
  });

  describe('envio', () => {
    it('envia a senha e, no sucesso, fecha e vai para /auth?conta=excluida', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-submit');
      expect(deleteAccount).toHaveBeenCalledWith({ password: 'SenhaSegura1' });
      expect(navigate).toHaveBeenCalledWith(['/auth'], { queryParams: { conta: 'excluida' }, replaceUrl: true });
      expect(fixture.componentInstance.visible()).toBe(false);
    });

    it('conta só com o Google envia sem senha', async () => {
      await create(GOOGLE_ACCOUNT);
      await open();
      await type('account-delete-confirm-text', 'EXCLUIR');
      await click('account-delete-submit');
      expect(deleteAccount).toHaveBeenCalledWith({});
      expect(navigate).toHaveBeenCalled();
    });

    it('invalid_password: mostra "Senha incorreta.", limpa a senha e não sai da tela', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'invalid_password' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'errada123');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain('Senha incorreta.');
      expect((byId('account-delete-password') as HTMLInputElement).value).toBe('');
      expect(byId('account-delete-password')?.getAttribute('aria-invalid')).toBe('true');
      expect(submit().disabled).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('reauth_required com senha: pede para confirmar que é a pessoa e mantém o campo de senha', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'reauth_required', method: 'password' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain('Confirme que é você para excluir a conta.');
      expect(byId('account-delete-password')).not.toBeNull();
      expect(byId('account-delete-google-reauth')).toBeNull();
    });

    it('reauth_required com Google: mostra o botão "Entrar de novo com o Google", que guarda a volta e abre o Google', async () => {
      await create(GOOGLE_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'reauth_required', method: 'google' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain('Confirme que é você para excluir a conta.');
      const google = byId('account-delete-google-reauth');
      expect(google?.textContent).toContain('Entrar de novo com o Google');
      google!.click();
      await settle();
      expect(capture).toHaveBeenCalledWith('/app/conta/privacidade');
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(capture.mock.invocationCallOrder[0]).toBeLessThan(signInWithGoogle.mock.invocationCallOrder[0]);
    });

    it('reauth_required com método de senha numa conta só com Google mostra o campo de senha', async () => {
      await create(GOOGLE_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'reauth_required', method: 'password' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await click('account-delete-submit');
      expect(byId('account-delete-password')).not.toBeNull();
    });

    it('rate_limited: usa o tempo devolvido pelo servidor', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'rate_limited', retryAfterSeconds: 840 });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'x');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain('Muitas tentativas. Tente de novo em 14 minutos.');
    });

    it('deletion_unavailable: avisa que nada foi apagado', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'deletion_unavailable' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'x');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain(
        'Não foi possível excluir sua conta agora. Nada foi apagado. Tente mais tarde.',
      );
      expect(navigate).not.toHaveBeenCalled();
    });

    it('deletion_incomplete: pede para tocar em excluir de novo, e a pessoa pode repetir', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValueOnce({ ok: false, error: 'deletion_incomplete' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain(
        'A exclusão não terminou. Toque em excluir de novo para concluir.',
      );
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-submit');
      expect(deleteAccount).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalled();
    });

    it('network: mostra o aviso de conexão', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      deleteAccount.mockResolvedValue({ ok: false, error: 'network' });
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'x');
      await click('account-delete-submit');
      expect(byId('account-delete-error')?.textContent).toContain('Não conseguimos conectar');
    });

    it('durante a exclusão o diálogo não fecha e os botões ficam desabilitados', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      let finish!: (value: unknown) => void;
      deleteAccount.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-submit');
      expect((byId('account-delete-cancel') as HTMLButtonElement).disabled).toBe(true);
      fixture.componentInstance.visible.set(false);
      await settle();
      expect(fixture.componentInstance.visible()).toBe(true);
      finish({ ok: false, error: 'network' });
      await settle();
      expect((byId('account-delete-cancel') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('cancelar', () => {
    it('fecha, não chama o serviço e limpa os campos ao reabrir', async () => {
      await create(PASSWORD_ACCOUNT);
      await open();
      await type('account-delete-confirm-text', 'EXCLUIR');
      await type('account-delete-password', 'SenhaSegura1');
      await click('account-delete-cancel');
      expect(fixture.componentInstance.visible()).toBe(false);
      expect(deleteAccount).not.toHaveBeenCalled();

      await open();
      expect((byId('account-delete-confirm-text') as HTMLInputElement).value).toBe('');
      expect((byId('account-delete-password') as HTMLInputElement).value).toBe('');
      expect(submit().disabled).toBe(true);
    });
  });
});
