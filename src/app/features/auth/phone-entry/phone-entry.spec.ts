import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AccountService } from '../../../core/account/account.service';
import type { Account } from '../../../core/account/account.store';
import { PhoneVerificationService } from '../../../core/account/phone-verification.service';
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

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function create(opts: { query?: Record<string, string>; account?: Account | null } = {}) {
    start = vi.fn().mockResolvedValue(START_OK);
    go = vi.fn().mockResolvedValue(true);
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
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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
});
