import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AccountService } from '../../../core/account/account.service';
import { AccountStore, type Account } from '../../../core/account/account.store';
import { PhoneVerificationService } from '../../../core/account/phone-verification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { PhoneEntry } from './phone-entry';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u1',
  nome: 'Ana',
  email: 'ana@email.com',
  papel: 'tutor',
  celular: null,
  celularConfirmadoEm: null,
  celularPendente: '+5511987654421',
  termosAceitosEm: '2026-11-21T11:00:00Z',
  termosVersao: '2026-11',
  temSenha: true,
  provedores: ['email'],
  criadoEm: '2026-11-21T11:00:00Z',
  ...over,
});

const START_OK = {
  ok: true,
  phone: '+5511987654421',
  expiresAt: '2026-11-21T12:10:00Z',
  resendAvailableAt: '2026-11-21T12:01:00Z',
  attemptsLeft: 5,
};

describe('PhoneEntry', () => {
  let fixture: ComponentFixture<PhoneEntry>;
  let el: HTMLElement;
  let start: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let capture: ReturnType<typeof vi.fn>;
  let clear: ReturnType<typeof vi.fn>;
  let signInWithGoogle: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function create(opts: { query?: Record<string, string>; account?: Account | null } = {}) {
    start = vi.fn().mockResolvedValue(START_OK);
    go = vi.fn().mockResolvedValue(true);
    capture = vi.fn();
    clear = vi.fn();
    signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    const params = new BehaviorSubject(convertToParamMap(opts.query ?? {}));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
        {
          provide: AccountService,
          useValue: { ensureLoaded: vi.fn().mockResolvedValue(opts.account === undefined ? account() : opts.account) },
        },
        { provide: PhoneVerificationService, useValue: { start } },
        { provide: PostAuthNavigator, useValue: { go } },
        { provide: AuthService, useValue: { signInWithGoogle } },
        { provide: ReturnUrlService, useValue: { capture, clear } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const loaded = opts.account === undefined ? account() : opts.account;
    if (loaded) TestBed.inject(AccountStore).set(loaded);
    fixture = TestBed.createComponent(PhoneEntry);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
  }

  async function settle() {
    // Com relógio falso o agendamento de detecção do Angular (setTimeout/rAF) também é falso.
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
    else await fixture.whenStable();
    fixture.detectChanges();
  }

  async function send() {
    byId('phone-send')!.click();
    await settle();
    await settle();
  }

  async function typePhone(value: string) {
    const input = byId('phone-input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tem os data-testid do contrato', async () => {
    await create();
    for (const id of ['phone-input', 'phone-send', 'phone-skip']) {
      expect(byId(id), id).not.toBeNull();
    }
  });

  it('pré-preenche com o número pendente, formatado', async () => {
    await create();
    expect((byId('phone-input') as HTMLInputElement).value).toBe('(11) 98765-4421');
  });

  it('sem número pendente o campo começa vazio', async () => {
    await create({ account: account({ celularPendente: null }) });
    expect((byId('phone-input') as HTMLInputElement).value).toBe('');
  });

  it('envia o número em E.164 e, com sucesso, vai para /auth/confirmar-celular', async () => {
    await create();
    await send();
    expect(start).toHaveBeenCalledWith({ phone: '+5511987654421' });
    expect(navigate).toHaveBeenCalledWith(['/auth/confirmar-celular'], {});
  });

  it('preserva o returnUrl ao ir para a confirmação', async () => {
    await create({ query: { returnUrl: '/ativar/7K3M-Q9XA-C' } });
    await send();
    expect(navigate).toHaveBeenCalledWith(['/auth/confirmar-celular'], {
      queryParams: { returnUrl: '/ativar/7K3M-Q9XA-C' },
    });
  });

  it('ignora returnUrl externo', async () => {
    await create({ query: { returnUrl: 'https://evil.com' } });
    await send();
    expect(navigate).toHaveBeenCalledWith(['/auth/confirmar-celular'], {});
  });

  it('número que não é celular não chama o servidor e marca o campo', async () => {
    await create({ account: account({ celularPendente: null }) });
    await typePhone('1133334444');
    await send();
    expect(start).not.toHaveBeenCalled();
    expect(byId('phone-error')?.textContent).toContain('Confira o número. Use DDD + celular, como (11) 98765-4321.');
    expect(byId('phone-input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('invalid_phone do servidor mostra o texto do contrato e não navega', async () => {
    await create();
    start.mockResolvedValue({ ok: false, error: 'invalid_phone' });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Confira o número. Use DDD + celular, como (11) 98765-4321.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rate_limited mostra o texto com o tempo, e o "Agora não" continua disponível', async () => {
    await create();
    start.mockResolvedValue({ ok: false, error: 'rate_limited', retryAfterSeconds: 3600 });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Muitos pedidos de código. Tente de novo em 1 hora.');
    expect((byId('phone-skip') as HTMLButtonElement).disabled).toBe(false);
  });

  it('sms_unavailable, sms_send_failed e network mostram os textos do contrato', async () => {
    await create();
    start.mockResolvedValue({ ok: false, error: 'sms_unavailable' });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Não conseguimos enviar o SMS agora. Tente de novo mais tarde.');
    start.mockResolvedValue({ ok: false, error: 'sms_send_failed' });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Não conseguimos enviar o SMS agora. Tente de novo.');
    start.mockResolvedValue({ ok: false, error: 'network' });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Não conseguimos conectar.');
  });

  it('cooldown mostra a contagem, desabilita o envio e reabilita ao zerar (relógio falso)', async () => {
    vi.useFakeTimers();
    await create();
    start.mockResolvedValue({ ok: false, error: 'cooldown', retryAfterSeconds: 30 });
    await send();
    expect(byId('phone-error')?.textContent).toContain('Você poderá enviar em 0:30');
    expect((byId('phone-send') as HTMLButtonElement).disabled).toBe(true);
    vi.advanceTimersByTime(12_000);
    await settle();
    expect(byId('phone-error')?.textContent).toContain('0:18');
    vi.advanceTimersByTime(18_000);
    await settle();
    expect(byId('phone-error')).toBeNull();
    expect((byId('phone-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('terms_required leva para /auth/termos', async () => {
    await create({ query: { returnUrl: '/app/conta' } });
    start.mockResolvedValue({ ok: false, error: 'terms_required' });
    await send();
    expect(navigate).toHaveBeenCalledWith(['/auth/termos'], { queryParams: { returnUrl: '/app/conta' } });
  });

  it('"Agora não" chama PostAuthNavigator.go({ skipPhone: true })', async () => {
    await create();
    byId('phone-skip')!.click();
    await settle();
    expect(go).toHaveBeenCalledWith({ skipPhone: true });
    expect(start).not.toHaveBeenCalled();
  });

  it('a região de erros é aria-live="polite" e existe antes do erro aparecer', async () => {
    await create();
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  describe('modo troca (celular já confirmado)', () => {
    const confirmed = (over: Partial<Account> = {}) =>
      account({ celular: '+5511987654421', celularConfirmadoEm: '2026-11-02T12:00:00Z', celularPendente: null, ...over });

    async function createChange(over: Partial<Account> = {}, query: Record<string, string> = {}) {
      await create({ account: confirmed(over), query });
    }

    it('mostra "Novo celular", o celular atual, "Cancelar" e o campo de senha (conta com senha)', async () => {
      await createChange();
      expect(byId('phone-title')?.textContent).toContain('Novo celular');
      expect(byId('phone-current')?.textContent).toContain(
        'Seu celular atual: (11) 98765-4421. Ele continua valendo até você confirmar o novo.',
      );
      expect(byId('phone-skip')?.textContent).toContain('Cancelar');
      expect(byId('phone-password')).not.toBeNull();
      expect(el.textContent).not.toContain('Sem celular confirmado, não dá para ativar uma tag.');
    });

    it('sem modo troca não há celular atual nem campo de senha', async () => {
      await create();
      expect(byId('phone-current')).toBeNull();
      expect(byId('phone-password')).toBeNull();
      expect(byId('phone-title')?.textContent).toContain('Qual é o seu celular?');
    });

    it('"Cancelar" volta ao returnUrl, ou à tela do celular, sem chamar o servidor', async () => {
      await createChange({}, { returnUrl: '/app/conta/celular' });
      byId('phone-skip')!.click();
      await settle();
      expect(navigateByUrl).toHaveBeenCalledWith('/app/conta/celular');
      expect(clear).toHaveBeenCalledTimes(1);
      expect(go).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    });

    it('envia a senha junto do número e a limpa depois da resposta', async () => {
      await createChange();
      await typePhone('(11) 91234-5678');
      const password = byId('phone-password') as HTMLInputElement;
      expect((byId('phone-send') as HTMLButtonElement).disabled).toBe(true);
      password.value = 'senhasegura';
      password.dispatchEvent(new Event('input'));
      await settle();
      expect((byId('phone-send') as HTMLButtonElement).disabled).toBe(false);
      await send();
      expect(start).toHaveBeenCalledWith({ phone: '+5511912345678', password: 'senhasegura' });
      expect((byId('phone-password') as HTMLInputElement | null)?.value ?? '').toBe('');
      expect(navigate).toHaveBeenCalledWith(['/auth/confirmar-celular'], {});
    });

    it('reauth_required com method password mostra o campo (conta sem senha cadastrada na tela) e pede a senha', async () => {
      await createChange({ temSenha: false, provedores: ['google'] });
      expect(byId('phone-password')).toBeNull();
      await typePhone('(11) 91234-5678');
      start.mockResolvedValueOnce({ ok: false, error: 'reauth_required', method: 'password' });
      await send();
      expect(start).toHaveBeenCalledWith({ phone: '+5511912345678' });
      expect(byId('phone-error')?.textContent).toContain('Para trocar o celular, confirme que é você.');
      expect(byId('phone-password')).not.toBeNull();
      expect(byId('phone-google-reauth')).toBeNull();
    });

    it('reauth_required com method google mostra o botão, guarda a volta e abre o Google', async () => {
      await createChange({ temSenha: false, provedores: ['google'] });
      await typePhone('(11) 91234-5678');
      start.mockResolvedValueOnce({ ok: false, error: 'reauth_required', method: 'google' });
      await send();
      const button = byId('phone-google-reauth');
      expect(button).not.toBeNull();
      expect(byId('phone-password')).toBeNull();
      button!.click();
      await settle();
      expect(capture).toHaveBeenCalledWith('/app/conta/celular');
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('invalid_password mostra "Senha incorreta.", marca o campo e limpa a senha digitada', async () => {
      await createChange();
      await typePhone('(11) 91234-5678');
      const password = byId('phone-password') as HTMLInputElement;
      password.value = 'errada';
      password.dispatchEvent(new Event('input'));
      await settle();
      start.mockResolvedValueOnce({ ok: false, error: 'invalid_password' });
      await send();
      expect(byId('phone-error')?.textContent).toContain('Senha incorreta.');
      expect(byId('phone-password')!.getAttribute('aria-invalid')).toBe('true');
      expect((byId('phone-password') as HTMLInputElement).value).toBe('');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('same_number mostra "Este já é o seu celular confirmado."', async () => {
      await createChange();
      await typePhone('(11) 98765-4421');
      const password = byId('phone-password') as HTMLInputElement;
      password.value = 'senhasegura';
      password.dispatchEvent(new Event('input'));
      await settle();
      start.mockResolvedValueOnce({ ok: false, error: 'same_number' });
      await send();
      expect(byId('phone-error')?.textContent).toContain('Este já é o seu celular confirmado.');
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
