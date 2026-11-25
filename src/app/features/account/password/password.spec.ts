import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TURNSTILE_SITE_KEY } from '@/shared/components/faro/turnstile/turnstile-script';
import { FakeTurnstile, TEST_TURNSTILE_SITE_KEY } from '@/shared/components/faro/turnstile/turnstile-testing';

import { AccountService } from '../../../core/account/account.service';
import { Account, AccountStore } from '../../../core/account/account.store';
import { PasswordService } from '../../../core/auth/password.service';
import { AccountPassword } from './password';

const WITH_PASSWORD: Account = {
  id: 'u1',
  nome: 'Ana Souza',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: '+5511987654421',
  celularConfirmadoEm: '2026-11-02T15:00:00Z',
  celularPendente: null,
  termosAceitosEm: '2026-11-01T11:58:00Z',
  termosVersao: '2026-11',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-01T11:58:00Z',
};

describe('AccountPassword', () => {
  let fixture: ComponentFixture<AccountPassword>;
  let el: HTMLElement;
  let changePassword: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const field = (id: string) => byId(id) as HTMLInputElement;
  const submit = () => byId('account-password-submit') as HTMLButtonElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(account: Account | null) {
    changePassword = vi.fn().mockResolvedValue({ ok: true });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AccountService,
          useValue: { ensureLoaded: vi.fn().mockResolvedValue(account), load: vi.fn().mockResolvedValue(account) },
        },
        { provide: PasswordService, useValue: { changePassword } },
      ],
    });
    if (account) TestBed.inject(AccountStore).set(account);
    fixture = TestBed.createComponent(AccountPassword);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  async function type(current: string, next: string) {
    field('account-password-current').value = current;
    field('account-password-current').dispatchEvent(new Event('input'));
    field('account-password-new').value = next;
    field('account-password-new').dispatchEvent(new Event('input'));
    await settle();
  }

  async function send() {
    submit().click();
    await settle();
    await settle();
  }

  describe('desafio anti-robô', () => {
    let fake: FakeTurnstile;
    beforeEach(() => {
      fake = new FakeTurnstile().install();
      TestBed.overrideProvider(TURNSTILE_SITE_KEY, { useValue: TEST_TURNSTILE_SITE_KEY });
    });
    afterEach(() => fake.uninstall());

    it('o envio espera o token, leva o captchaToken e renova o desafio', async () => {
      await create(WITH_PASSWORD);
      await vi.waitFor(() => expect(fake.renders).toHaveLength(1));
      await type('atual123', 'NovaSenha123');
      expect(submit().disabled).toBe(true);
      fake.solve('tok-1');
      await settle();
      expect(submit().disabled).toBe(false);
      await send();
      expect(changePassword).toHaveBeenCalledWith('atual123', 'NovaSenha123', 'tok-1');
      expect(fake.resets).toBe(1);
    });

    it('captcha_failed mostra o texto do contrato e não diz que trocou a senha', async () => {
      await create(WITH_PASSWORD);
      await vi.waitFor(() => expect(fake.renders).toHaveLength(1));
      await type('atual123', 'NovaSenha123');
      fake.solve('tok-1');
      await settle();
      changePassword.mockResolvedValue({ ok: false, reason: 'captcha_failed' });
      await send();
      expect(byId('account-password-error')?.textContent).toContain(
        'Não foi possível confirmar que você não é um robô. Tente de novo.',
      );
      expect(byId('account-password-success')).toBeNull();
      expect(fake.resets).toBe(1);
    });
  });

  it('conta com senha: mostra os dois campos e o botão, e não mostra a nota do Google', async () => {
    await create(WITH_PASSWORD);
    for (const id of ['account-password-current', 'account-password-new', 'account-password-submit']) {
      expect(byId(id), id).not.toBeNull();
    }
    expect(byId('account-password-google-note')).toBeNull();
    expect(el.textContent).toContain('Ao trocar a senha, as outras sessões abertas são encerradas.');
  });

  it('conta só com o Google: só a nota do contrato, sem formulário', async () => {
    await create({ ...WITH_PASSWORD, temSenha: false, provedores: ['google'] });
    expect(byId('account-password-google-note')?.textContent).toContain(
      "Sua conta usa o login do Google. Para criar uma senha, use 'Esqueci a senha' na tela de entrada.",
    );
    expect(byId('account-password-current')).toBeNull();
    expect(byId('account-password-new')).toBeNull();
    expect(byId('account-password-submit')).toBeNull();
  });

  it('o botão só habilita com os dois campos preenchidos', async () => {
    await create(WITH_PASSWORD);
    expect(submit().disabled).toBe(true);
    await type('atual123', '');
    expect(submit().disabled).toBe(true);
    await type('atual123', 'nova');
    expect(submit().disabled).toBe(false);
  });

  it('nova senha com 7 caracteres não chama o servidor e mostra o texto do contrato', async () => {
    await create(WITH_PASSWORD);
    await type('atual123', '1234567');
    await send();
    expect(changePassword).not.toHaveBeenCalled();
    expect(byId('account-password-error')?.textContent).toContain('Use uma senha com pelo menos 8 caracteres.');
    expect(field('account-password-new').getAttribute('aria-invalid')).toBe('true');
  });

  it('nova senha com 73 caracteres não chama o servidor', async () => {
    await create(WITH_PASSWORD);
    await type('atual123', 'a'.repeat(73));
    await send();
    expect(changePassword).not.toHaveBeenCalled();
    expect(byId('account-password-error')?.textContent).toContain('Use no máximo 72 caracteres.');
  });

  it('8 e 72 caracteres chamam o servidor', async () => {
    await create(WITH_PASSWORD);
    await type('atual123', '12345678');
    await send();
    expect(changePassword).toHaveBeenLastCalledWith('atual123', '12345678', undefined);
    await type('atual123', 'a'.repeat(72));
    await send();
    expect(changePassword).toHaveBeenLastCalledWith('atual123', 'a'.repeat(72), undefined);
  });

  it('sucesso: mostra o aviso e limpa os dois campos', async () => {
    await create(WITH_PASSWORD);
    await type('atual123', 'NovaSenha123');
    await send();
    expect(byId('account-password-success')?.textContent).toContain(
      'Senha alterada. As outras sessões foram encerradas.',
    );
    expect(field('account-password-current').value).toBe('');
    expect(field('account-password-new').value).toBe('');
  });

  it('invalid_current: "Senha atual incorreta." e o campo da senha atual é limpo', async () => {
    await create(WITH_PASSWORD);
    changePassword.mockResolvedValue({ ok: false, reason: 'invalid_current' });
    await type('errada123', 'NovaSenha123');
    await send();
    expect(byId('account-password-error')?.textContent).toContain('Senha atual incorreta.');
    expect(field('account-password-current').getAttribute('aria-invalid')).toBe('true');
    expect(field('account-password-current').value).toBe('');
    expect(byId('account-password-success')).toBeNull();
  });

  it('weak_password do servidor, rate_limited e network mostram os textos do contrato', async () => {
    await create(WITH_PASSWORD);
    changePassword.mockResolvedValue({ ok: false, reason: 'weak_password' });
    await type('atual123', 'NovaSenha123');
    await send();
    expect(byId('account-password-error')?.textContent).toContain('Use uma senha com pelo menos 8 caracteres.');

    changePassword.mockResolvedValue({ ok: false, reason: 'rate_limited' });
    await type('atual123', 'NovaSenha123');
    await send();
    expect(byId('account-password-error')?.textContent).toContain('Muitas tentativas. Aguarde alguns minutos.');

    changePassword.mockResolvedValue({ ok: false, reason: 'network' });
    await type('atual123', 'NovaSenha123');
    await send();
    expect(byId('account-password-error')?.textContent).toContain('Não conseguimos conectar.');
  });

  it('o botão de mostrar alterna o tipo do campo e o rótulo', async () => {
    await create(WITH_PASSWORD);
    const toggle = byId('account-password-new-toggle') as HTMLButtonElement;
    expect(field('account-password-new').type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
    toggle.click();
    await settle();
    expect(field('account-password-new').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar senha');
  });

  it('conta que não carregou termina em aviso com "Tentar de novo"', async () => {
    await create(null);
    expect(byId('account-password-load-error')).not.toBeNull();
    expect(byId('account-password-retry')).not.toBeNull();
  });
});
