import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { RegistrationService } from '../../../core/auth/registration.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { Signup } from './signup';

describe('Signup', () => {
  let fixture: ComponentFixture<Signup>;
  let el: HTMLElement;
  let signUp: ReturnType<typeof vi.fn>;
  let signInWithGoogle: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const field = (id: string) => byId(id) as HTMLInputElement;

  async function type(id: string, value: string) {
    const input = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function check() {
    el.querySelector<HTMLInputElement>('[data-testid="signup-terms"] input')!.click();
    await fixture.whenStable();
  }

  async function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function fillValid() {
    await type('signup-name', 'Ana Souza');
    await type('signup-email', 'ana@email.com');
    await type('signup-phone', '11987654421');
    await type('signup-password', 'SenhaSegura1');
    await check();
  }

  beforeEach(async () => {
    signUp = vi.fn().mockResolvedValue({ ok: true });
    signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: RegistrationService, useValue: { signUp } },
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
        { provide: AuthService, useValue: { signInWithGoogle } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Signup);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('tem os data-testid do contrato', () => {
    for (const id of [
      'signup-name',
      'signup-email',
      'signup-phone',
      'signup-password',
      'signup-password-toggle',
      'signup-terms',
      'signup-submit',
      'signup-login-link',
      'signup-google',
    ]) {
      expect(byId(id), id).not.toBeNull();
    }
  });

  it('atributos dos campos: autocomplete, tipo e inputmode', () => {
    expect(field('signup-email').getAttribute('autocomplete')).toBe('email');
    expect(field('signup-email').type).toBe('email');
    expect(field('signup-phone').type).toBe('tel');
    expect(field('signup-phone').getAttribute('inputmode')).toBe('numeric');
    expect(field('signup-phone').getAttribute('autocomplete')).toBe('tel-national');
    expect(field('signup-password').getAttribute('autocomplete')).toBe('new-password');
    expect(field('signup-password').type).toBe('password');
  });

  it('o botão de olho alterna a visibilidade da senha', async () => {
    byId('signup-password-toggle')!.click();
    await fixture.whenStable();
    expect(field('signup-password').type).toBe('text');
    expect(byId('signup-password-toggle')!.getAttribute('aria-label')).toBe('Ocultar senha');
  });

  it('aplica a máscara no celular enquanto digita', async () => {
    await type('signup-phone', '11987654421');
    expect(field('signup-phone').value).toBe('(11) 98765-4421');
  });

  describe('validação (nada é enviado)', () => {
    async function expectInvalid(errorId: string, mutate: () => Promise<void>) {
      await fillValid();
      await mutate();
      await submit();
      expect(byId(errorId), errorId).not.toBeNull();
      expect(signUp).not.toHaveBeenCalled();
    }

    it('nome vazio e nome de 1 caractere', async () => {
      await expectInvalid('signup-name-error', () => type('signup-name', 'A'));
    });

    it('nome de 81 caracteres', async () => {
      await expectInvalid('signup-name-error', () => type('signup-name', 'A'.repeat(81)));
    });

    it('e-mail inválido', async () => {
      await expectInvalid('signup-email-error', () => type('signup-email', 'ana@email'));
    });

    it('celular fixo', async () => {
      await expectInvalid('signup-phone-error', () => type('signup-phone', '1134567890'));
    });

    it('senha de 7 caracteres', async () => {
      await expectInvalid('signup-password-error', () => type('signup-password', '1234567'));
    });

    it('aceite desmarcado', async () => {
      await expectInvalid('signup-terms-error', () => check());
    });

    it('formulário vazio mostra o erro de todos os campos e marca aria-invalid', async () => {
      await submit();
      for (const id of [
        'signup-name-error',
        'signup-email-error',
        'signup-phone-error',
        'signup-password-error',
        'signup-terms-error',
      ]) {
        expect(byId(id), id).not.toBeNull();
      }
      expect(field('signup-email').getAttribute('aria-invalid')).toBe('true');
      expect(signUp).not.toHaveBeenCalled();
    });

    it('aceita nome de 2 e de 80 caracteres e senha de 8', async () => {
      await fillValid();
      await type('signup-name', 'Al');
      await type('signup-password', '12345678');
      await submit();
      expect(signUp).toHaveBeenCalledTimes(1);
      signUp.mockClear();
      await type('signup-name', 'A'.repeat(80));
      await submit();
      expect(signUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('envio', () => {
    it('chama signUp com os dados e navega com o e-mail no estado, não na URL', async () => {
      await fillValid();
      await submit();
      expect(signUp).toHaveBeenCalledWith({
        nome: 'Ana Souza',
        email: 'ana@email.com',
        celular: '(11) 98765-4421',
        senha: 'SenhaSegura1',
        aceite: true,
      });
      expect(navigate).toHaveBeenCalledTimes(1);
      const [commands, extras] = navigate.mock.calls[0];
      expect(commands).toEqual(['/auth/confirmar-email']);
      expect(extras).toEqual({ state: { email: 'ana@email.com' } });
      expect(JSON.stringify(commands)).not.toContain('ana@email.com');
    });

    it('mantém o botão desabilitado enquanto envia', async () => {
      let release!: (v: unknown) => void;
      signUp.mockReturnValue(new Promise((resolve) => (release = resolve)));
      await fillValid();
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
      expect((byId('signup-submit') as HTMLButtonElement).disabled).toBe(true);
      release({ ok: false, reason: 'network' });
      await fixture.whenStable();
      fixture.detectChanges();
      expect((byId('signup-submit') as HTMLButtonElement).disabled).toBe(false);
    });

    it('senha fraca, limite e rede mostram o aviso e não navegam', async () => {
      const cases: [string, string][] = [
        ['weak_password', 'Use uma senha com pelo menos 8 caracteres.'],
        ['rate_limited', 'Muitas tentativas em sequência'],
        ['network', 'Não conseguimos conectar'],
      ];
      await fillValid();
      for (const [reason, text] of cases) {
        signUp.mockResolvedValue({ ok: false, reason });
        await submit();
        expect(byId('signup-error')?.textContent, reason).toContain(text);
        expect(navigate).not.toHaveBeenCalled();
      }
    });
  });

  describe('Continuar com o Google (T061)', () => {
    it('mostra a linha "ou" e o botão de contorno com o ícone oficial do Google', () => {
      const google = byId('signup-google') as HTMLButtonElement;
      expect(google.textContent).toContain('Continuar com o Google');
      expect(google.querySelector('app-google-glyph')).not.toBeNull();
      expect(google.querySelector('svg path[fill="#4285F4"]')).not.toBeNull();
      expect(google.getAttribute('data-variant')).toBe('outline');
      expect(el.textContent).toContain('ou');
    });

    it('o clique chama AuthService.signInWithGoogle() uma vez e mantém os botões desabilitados', async () => {
      signInWithGoogle.mockReturnValue(new Promise(() => undefined));
      byId('signup-google')!.click();
      byId('signup-google')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
      expect((byId('signup-google') as HTMLButtonElement).disabled).toBe(true);
      expect((byId('signup-submit') as HTMLButtonElement).disabled).toBe(true);
    });

    it('não envia o formulário nem navega', async () => {
      byId('signup-google')!.click();
      await fixture.whenStable();
      expect(signUp).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('falha do provedor mostra o aviso e reabilita o botão', async () => {
      signInWithGoogle.mockImplementation(async () => {
        TestBed.inject(AuthStore).setError('x');
      });
      byId('signup-google')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(byId('signup-error')?.textContent).toContain('Não conseguimos abrir o Google agora.');
      expect((byId('signup-google') as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
