/**
 * login.spec.ts — T031
 *
 * Testa validação de form, botão desabilitado em invalid,
 * exibição de erro genérico e presença dos data-testid.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { provideZonelessChangeDetection } from '@angular/core';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PostAuthNavigator } from '../../../core/auth/post-auth-navigation';

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
  let postAuthMock: { go: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = makeAuthServiceMock();
    postAuthMock = { go: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [Login, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        AuthStore,
        { provide: AuthService, useValue: authServiceMock },
        { provide: PostAuthNavigator, useValue: postAuthMock },
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

  // ── Spec 002: apresentação com ZardUI ──

  it('não deve ter nenhum componente p-* da pilha antiga no DOM', () => {
    const el: HTMLElement = fixture.nativeElement;
    for (const tag of ['p-button', 'p-password', 'p-checkbox', 'p-message', 'p-toast']) {
      expect(el.querySelector(tag)).toBeNull();
    }
  });

  it('o h1 deve conter "te ver de novo"', () => {
    const h1: HTMLElement = fixture.nativeElement.querySelector('h1');
    expect(h1.textContent).toContain('te ver de novo');
  });

  it('o botão de olho deve alternar o type da senha entre password e text', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="login-password"]');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="login-password-toggle"]');
    expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
  });

  it('o botão do Google deve ter o G com o caminho de cor #4285F4', () => {
    const svg = fixture.nativeElement.querySelector('[data-testid="login-google"] svg');
    expect(svg).toBeTruthy();
    expect(svg.querySelector('path[fill="#4285F4"]')).toBeTruthy();
  });

  // ── Spec 004 (T029): navegação pós-login pelo PostAuthNavigator ──

  it('login com sucesso chama PostAuthNavigator.go()', async () => {
    authServiceMock.signInPassword.mockResolvedValue({ ok: true, role: 'tutor' });
    component.form.setValue({ email: 'a@x.com', password: 'Senha12345', rememberMe: false });
    await component.onSubmit();
    expect(postAuthMock.go).toHaveBeenCalledTimes(1);
  });

  it('login com falha não chama PostAuthNavigator.go()', async () => {
    component.form.setValue({ email: 'a@x.com', password: 'errada123', rememberMe: false });
    await component.onSubmit();
    expect(postAuthMock.go).not.toHaveBeenCalled();
  });

  // ── Spec 004 (T037): link para criar conta e botão Voltar ──

  it('o link login-signup-link vai para /auth/criar-conta, sem aria-label "em breve"', () => {
    const link = fixture.nativeElement.querySelector('[data-testid="login-signup-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/auth/criar-conta');
    expect(link.getAttribute('aria-label')).toBeNull();
  });

  it('o link para criar conta e o Voltar preservam o returnUrl', () => {
    component.linkQueryParams.set({ returnUrl: '/ativar/7K3M-Q9XA-C' });
    fixture.detectChanges();
    const q = '?returnUrl=%2Fativar%2F7K3M-Q9XA-C';
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="login-signup-link"]')!.getAttribute('href')).toBe('/auth/criar-conta' + q);
    expect(el.querySelector('[data-testid="login-back"]')!.getAttribute('href')).toBe('/auth' + q);
  });

  it('o botão Voltar vai para /auth e tem rótulo acessível', () => {
    const back = fixture.nativeElement.querySelector('[data-testid="login-back"]') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/auth');
    expect(back.getAttribute('aria-label')).toBe('Voltar');
  });

  // ── Correção: z-button só desabilita por [zDisabled] (o host sobrescreve o atributo disabled) ──

  it('o botão Entrar fica de fato desabilitado em rate_limited e habilitado fora dele', async () => {
    const submit = () => fixture.nativeElement.querySelector('[data-testid="login-submit"]') as HTMLButtonElement;
    expect(submit().disabled).toBe(false);
    component.formError.set('rate_limited');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(submit().disabled).toBe(true);
    expect(submit().hasAttribute('disabled')).toBe(true);
  });

  it('o botão Entrar continua desabilitado em rate_limited depois que o envio termina (zLoading não o reabilita)', async () => {
    const submit = () => fixture.nativeElement.querySelector('[data-testid="login-submit"]') as HTMLButtonElement;
    component.isLoading.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(submit().disabled).toBe(true);
    component.formError.set('rate_limited');
    component.isLoading.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(submit().disabled).toBe(true);
  });

  it('o botão do Google fica de fato desabilitado quando o provedor está indisponível', async () => {
    const google = () => fixture.nativeElement.querySelector('[data-testid="login-google"]') as HTMLButtonElement;
    expect(google().disabled).toBe(false);
    component.isGoogleDisabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(google().disabled).toBe(true);
  });

  // ── Spec 004 (T071): recuperar a senha ──

  it('o link "Esqueci a senha" vai para /auth/recuperar-senha, sem aria-label "em breve"', () => {
    const link = fixture.nativeElement.querySelector('[data-testid="login-forgot-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/auth/recuperar-senha');
    expect(link.getAttribute('aria-label')).toBeNull();
    component.linkQueryParams.set({ returnUrl: '/app/conta' });
    fixture.detectChanges();
    expect(link.getAttribute('href')).toBe('/auth/recuperar-senha?returnUrl=%2Fapp%2Fconta');
  });

  it('?senha=alterada mostra o aviso de sucesso; sem o parâmetro não há aviso', async () => {
    const notice = () => fixture.nativeElement.querySelector('[data-testid="login-password-changed"]') as HTMLElement | null;
    expect(notice()).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/?senha=alterada');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(notice()?.textContent).toContain('Senha alterada. Entre com a nova senha.');
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(notice()).toBeNull();
  });
});
