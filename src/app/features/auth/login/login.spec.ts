/**
 * login.spec.ts — T031
 *
 * Testa validação de form, botão desabilitado em invalid,
 * exibição de erro genérico e presença dos data-testid.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { provideZonelessChangeDetection } from '@angular/core';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { MessageService } from 'primeng/api';

function makeAuthServiceMock() {
  return {
    signInPassword: vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' }),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    resendConfirmation: vi.fn().mockResolvedValue(undefined),
    setRememberMe: vi.fn(),
    isUnconfirmed: Object.assign(() => false, { asReadonly: () => () => false }),
    getErrorMessage: vi.fn().mockReturnValue('E-mail ou senha inválidos. Verifique e tente de novo.'),
  };
}

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authServiceMock: ReturnType<typeof makeAuthServiceMock>;

  beforeEach(async () => {
    authServiceMock = makeAuthServiceMock();

    await TestBed.configureTestingModule({
      imports: [Login, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        AuthStore,
        MessageService,
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  // ── data-testid presentes no DOM ──

  it('deve ter data-testid="login-email" no campo de e-mail', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-email"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-password" no campo de senha', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-password"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-password-toggle" no toggle de senha', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-password-toggle"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-remember" no checkbox', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-remember"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-submit" no botão Entrar', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-submit"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-google" no botão Google', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-google"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-forgot-link"', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-forgot-link"]');
    expect(el).toBeTruthy();
  });

  it('deve ter data-testid="login-signup-link"', () => {
    const el = fixture.nativeElement.querySelector('[data-testid="login-signup-link"]');
    expect(el).toBeTruthy();
  });

  // ── Validação de formulário (FR-004) ──

  it('form deve ser inválido quando vazio', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('form deve ser válido com e-mail e senha preenchidos', () => {
    component.form.setValue({ email: 'test@example.com', password: 'senha123', rememberMe: false });
    expect(component.form.valid).toBe(true);
  });

  it('deve marcar email como inválido com e-mail sem @', () => {
    const emailCtrl = component.form.get('email')!;
    // Sem @ → inválido pelo Validators.email
    emailCtrl.setValue('naoehumemailvalido');
    emailCtrl.markAsTouched();
    fixture.detectChanges();
    expect(emailCtrl.invalid).toBe(true);
  });

  it('deve exibir erro inline de e-mail após touch com campo vazio', () => {
    const emailCtrl = component.form.get('email')!;
    emailCtrl.setValue('');
    emailCtrl.markAsTouched();
    // computed() reavalia ao ser chamado diretamente (sem necessidade de detectChanges para signals)
    const err = component.emailFieldError;
    expect(err).toBeTruthy();
    expect(err).toContain('e-mail');
  });

  it('deve exibir erro inline de senha após touch com campo vazio', () => {
    const passwordCtrl = component.form.get('password')!;
    passwordCtrl.setValue('');
    passwordCtrl.markAsTouched();
    const err = component.passwordFieldError;
    expect(err).toBeTruthy();
    expect(err).toContain('senha');
  });

  // ── Erro genérico (anti-enumeração) ──

  it('deve exibir banner de erro genérico quando formError=invalid', async () => {
    component.formError.set('invalid');
    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('[data-testid="login-error"]');
    expect(banner).toBeTruthy();
  });

  it('botão submit deve estar desabilitado durante rate_limited', () => {
    component.formError.set('rate_limited');
    fixture.detectChanges();
    expect(component.submitButtonDisabled).toBe(true);
  });

  // ── Banner de unconfirmed ──

  it('deve exibir login-unconfirmed-notice quando isUnconfirmed=true', async () => {
    component.isUnconfirmed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const notice = fixture.nativeElement.querySelector('[data-testid="login-unconfirmed-notice"]');
    expect(notice).toBeTruthy();
  });

  it('deve ter botão login-resend-confirmation quando isUnconfirmed=true', async () => {
    component.isUnconfirmed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const btn = fixture.nativeElement.querySelector('[data-testid="login-resend-confirmation"]');
    expect(btn).toBeTruthy();
  });
});
