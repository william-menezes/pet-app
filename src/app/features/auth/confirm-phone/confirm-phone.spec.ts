import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import {
  PhoneVerificationService,
  type PhoneStatus,
} from '../../../core/account/phone-verification.service';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { ConfirmPhone } from './confirm-phone';

const STATUS: PhoneStatus = {
  phoneConfirmed: false,
  phone: null,
  pendingPhone: '+5511987654421',
  active: { expiresAt: '2099-01-01T00:10:00Z', attemptsLeft: 5 },
  resendAvailableAt: null,
};

const START_OK = {
  ok: true,
  phone: '+5511987654421',
  expiresAt: '2099-01-01T00:10:00Z',
  resendAvailableAt: '2099-01-01T00:01:00Z',
  attemptsLeft: 5,
};

describe('ConfirmPhone', () => {
  let fixture: ComponentFixture<ConfirmPhone>;
  let el: HTMLElement;
  let status: ReturnType<typeof vi.fn>;
  let start: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const cell = (n: number) => byId(`confirm-phone-cell-${n}`) as HTMLInputElement;
  const button = (id: string) => byId(id) as HTMLButtonElement;

  async function settle() {
    // Com relógio falso o agendamento de detecção do Angular (setTimeout/rAF) também é falso.
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
    else await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(
    opts: { query?: Record<string, string>; status?: PhoneStatus | null; now?: Date } = {},
  ) {
    status = vi.fn().mockResolvedValue(opts.status === undefined ? STATUS : opts.status);
    start = vi.fn().mockResolvedValue(START_OK);
    confirm = vi.fn().mockResolvedValue({ ok: true, phone: '+5511987654421' });
    go = vi.fn().mockResolvedValue(true);
    const params = new BehaviorSubject(convertToParamMap(opts.query ?? {}));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
        { provide: PhoneVerificationService, useValue: { status, start, confirm } },
        { provide: PostAuthNavigator, useValue: { go } },
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ConfirmPhone);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
    await settle();
    await settle();
  }

  async function paste(code: string) {
    const first = cell(1);
    first.value = code;
    first.dispatchEvent(new Event('input'));
    await settle();
    await settle();
  }

  async function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await settle();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('estado normal', () => {
    it('chama status() no init e mostra o número formatado', async () => {
      await create();
      expect(status).toHaveBeenCalledTimes(1);
      expect(byId('confirm-phone-number')?.textContent).toBe('(11) 98765-4421');
      expect(el.querySelector('h1')?.textContent).toContain('Confirme seu celular');
    });

    it('tem seis células numéricas com os data-testid do contrato e autocomplete de código', async () => {
      await create();
      for (let n = 1; n <= 6; n += 1) {
        expect(cell(n), `cell-${n}`).not.toBeNull();
        expect(cell(n).getAttribute('inputmode')).toBe('numeric');
        expect(cell(n).getAttribute('autocomplete')).toBe('one-time-code');
      }
      expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Código de 6 dígitos');
    });

    it('sem número pendente vai para /auth/celular, preservando o returnUrl', async () => {
      await create({ status: { ...STATUS, pendingPhone: null }, query: { returnUrl: '/app/conta' } });
      expect(navigate).toHaveBeenCalledWith(['/auth/celular'], {
        replaceUrl: true,
        queryParams: { returnUrl: '/app/conta' },
      });
      expect(byId('confirm-phone-cell-1')).toBeNull();
    });

    it('colar 482913 preenche as seis células e habilita o botão', async () => {
      await create();
      expect(button('confirm-phone-submit').disabled).toBe(true);
      await paste('482913');
      expect([1, 2, 3, 4, 5, 6].map((n) => cell(n).value).join('')).toBe('482913');
      expect(button('confirm-phone-submit').disabled).toBe(false);
    });

    it('com menos de 6 dígitos o botão continua desabilitado', async () => {
      await create();
      cell(1).value = '4';
      cell(1).dispatchEvent(new Event('input'));
      await settle();
      expect(button('confirm-phone-submit').disabled).toBe(true);
    });

    it('sucesso chama confirm(código) e PostAuthNavigator.go()', async () => {
      await create();
      await paste('482913');
      await submit();
      expect(confirm).toHaveBeenCalledWith('482913');
      expect(go).toHaveBeenCalledWith();
    });

    it('"Número errado? Corrigir" aponta para /auth/celular, com o returnUrl', async () => {
      await create({ query: { returnUrl: '/app/conta' } });
      expect(byId('confirm-phone-fix')?.getAttribute('href')).toBe('/auth/celular?returnUrl=%2Fapp%2Fconta');
    });

    it('"Continuar sem confirmar" não existe no estado normal', async () => {
      await create();
      expect(byId('confirm-phone-continue-without')).toBeNull();
    });

    it('a região de erros é aria-live="polite"', async () => {
      await create();
      expect(byId('confirm-phone-live')?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('contagem do reenvio', () => {
    it('mostra "Reenviar em m:ss" a partir de resendAvailableAt e vira botão ao zerar (relógio falso)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
      await create({ status: { ...STATUS, resendAvailableAt: '2099-01-01T00:00:42Z' } });
      expect(byId('confirm-phone-countdown')?.textContent).toContain('0:42');
      expect(byId('confirm-phone-resend')).toBeNull();
      vi.advanceTimersByTime(20_000);
      await settle();
      expect(byId('confirm-phone-countdown')?.textContent).toContain('0:22');
      vi.advanceTimersByTime(22_000);
      await settle();
      expect(byId('confirm-phone-countdown')).toBeNull();
      expect(byId('confirm-phone-resend')).not.toBeNull();
    });

    it('reenviar pede código novo, limpa as células e reinicia a contagem', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
      await create();
      expect(byId('confirm-phone-resend')).not.toBeNull();
      byId('confirm-phone-resend')!.click();
      await settle();
      await settle();
      expect(start).toHaveBeenCalledWith();
      expect(byId('confirm-phone-countdown')?.textContent).toContain('1:00');
      expect(byId('confirm-phone-resend')).toBeNull();
      expect(cell(1).value).toBe('');
    });
  });

  describe('estados de erro', () => {
    it('invalid_code: mostra as tentativas, limpa as células e foca a primeira', async () => {
      await create();
      confirm.mockResolvedValue({ ok: false, error: 'invalid_code', attemptsLeft: 2 });
      await paste('111111');
      await submit();
      expect(byId('confirm-phone-error')?.textContent).toContain('Código incorreto. Você tem mais 2 tentativas.');
      expect([1, 2, 3, 4, 5, 6].map((n) => cell(n).value).join('')).toBe('');
      expect(button('confirm-phone-submit').disabled).toBe(true);
      expect(cell(1).getAttribute('aria-invalid')).toBe('true');
      await settle();
      expect(document.activeElement).toBe(cell(1));
      expect(go).not.toHaveBeenCalled();
    });

    it('invalid_code com 1 tentativa usa o singular', async () => {
      await create();
      confirm.mockResolvedValue({ ok: false, error: 'invalid_code', attemptsLeft: 1 });
      await paste('111111');
      await submit();
      expect(byId('confirm-phone-error')?.textContent).toContain('Você tem mais 1 tentativa.');
    });

    it('locked: mostra "Muitas tentativas" e oferece reenviar, sem as células', async () => {
      await create();
      confirm.mockResolvedValue({ ok: false, error: 'locked', attemptsLeft: 0 });
      await paste('111111');
      await submit();
      expect(byId('confirm-phone-error')?.textContent).toContain('Muitas tentativas. Peça um novo código.');
      expect(byId('confirm-phone-cell-1')).toBeNull();
      expect(button('confirm-phone-resend').textContent).toContain('Reenviar código');
      expect(byId('confirm-phone-continue-without')).toBeNull();
    });

    it.each(['expired', 'no_active'] as const)('%s: "Este código venceu. Peça um novo." com reenvio', async (error) => {
      await create();
      confirm.mockResolvedValue({ ok: false, error });
      await paste('111111');
      await submit();
      expect(byId('confirm-phone-error')?.textContent).toContain('Este código venceu. Peça um novo.');
      expect(button('confirm-phone-resend')).not.toBeNull();
      expect(el.textContent).toContain('não vale mais');
    });

    it('depois de vencer, reenviar volta às seis células', async () => {
      await create();
      confirm.mockResolvedValue({ ok: false, error: 'expired' });
      await paste('111111');
      await submit();
      byId('confirm-phone-resend')!.click();
      await settle();
      await settle();
      expect(cell(1)).not.toBeNull();
      expect(byId('confirm-phone-error')).toBeNull();
    });

    it('network ao confirmar mantém as células e o código (ainda não foi usado)', async () => {
      await create();
      confirm.mockResolvedValue({ ok: false, error: 'network' });
      await paste('482913');
      await submit();
      expect(byId('confirm-phone-error')?.textContent).toContain('Não conseguimos conectar.');
      expect(cell(6).value).toBe('3');
    });

    it('cooldown no reenvio mostra a contagem e nenhum erro', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
      await create();
      start.mockResolvedValue({ ok: false, error: 'cooldown', retryAfterSeconds: 25 });
      byId('confirm-phone-resend')!.click();
      await settle();
      await settle();
      expect(byId('confirm-phone-countdown')?.textContent).toContain('0:25');
      expect(byId('confirm-phone-error')).toBeNull();
    });

    it('rate_limited no reenvio mostra o tempo e oferece "Continuar sem confirmar" e "Corrigir"', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
      await create();
      start.mockResolvedValue({ ok: false, error: 'rate_limited', retryAfterSeconds: 7200 });
      byId('confirm-phone-resend')!.click();
      await settle();
      await settle();
      expect(byId('confirm-phone-error')?.textContent).toContain('Muitos pedidos de código. Tente de novo em 2 horas.');
      expect(byId('confirm-phone-continue-without')).not.toBeNull();
      expect(byId('confirm-phone-fix')).not.toBeNull();
      byId('confirm-phone-continue-without')!.click();
      await settle();
      expect(go).toHaveBeenCalledWith({ skipPhone: true });
    });

    it.each(['sms_unavailable', 'sms_send_failed'] as const)(
      '%s: "Não conseguimos enviar o SMS agora." com "Tentar de novo" e "Continuar sem confirmar"',
      async (error) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
        await create();
        start.mockResolvedValue({ ok: false, error });
        byId('confirm-phone-resend')!.click();
        await settle();
        await settle();
        expect(byId('confirm-phone-error')?.textContent).toContain('Não conseguimos enviar o SMS agora.');
        expect(button('confirm-phone-resend').textContent).toContain('Tentar de novo');
        expect(byId('confirm-phone-continue-without')).not.toBeNull();
        expect(byId('confirm-phone-cell-1')).toBeNull();
        expect(el.textContent).toContain('Seu número fica guardado');
      },
    );

    it('terms_required no reenvio leva a /auth/termos', async () => {
      await create({ query: { returnUrl: '/app' } });
      start.mockResolvedValue({ ok: false, error: 'terms_required' });
      byId('confirm-phone-resend')!.click();
      await settle();
      await settle();
      expect(navigate).toHaveBeenCalledWith(['/auth/termos'], { queryParams: { returnUrl: '/app' } });
    });
  });

  describe('sem verificação ativa', () => {
    it('mostra "Peça um código" com o botão de enviar, sem as células', async () => {
      await create({ status: { ...STATUS, active: null } });
      expect(byId('confirm-phone-cell-1')).toBeNull();
      expect(el.textContent).toContain('Peça um código para continuar');
      expect(button('confirm-phone-resend').textContent).toContain('Enviar código por SMS');
      button('confirm-phone-resend').click();
      await settle();
      await settle();
      expect(start).toHaveBeenCalledTimes(1);
      expect(cell(1)).not.toBeNull();
    });
  });

  describe('falha ao carregar o status', () => {
    it('mostra o erro de rede com "Tentar de novo" e o caminho para corrigir o número', async () => {
      await create({ status: null });
      expect(byId('confirm-phone-error')?.textContent).toContain('Não conseguimos conectar.');
      expect(byId('confirm-phone-fix')).not.toBeNull();
      status.mockResolvedValue(STATUS);
      byId('confirm-phone-retry')!.click();
      await settle();
      await settle();
      expect(cell(1)).not.toBeNull();
    });
  });
});
