import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { PasswordService } from '../../../core/auth/password.service';
import { ReturnUrlService } from '../../../core/auth/return-url';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let el: HTMLElement;
  let resetPassword: ReturnType<typeof vi.fn>;
  let requestRecovery: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const VALID_QUERY = { token_hash: 'hash-do-link', type: 'recovery' };

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(query: Record<string, string> = VALID_QUERY) {
    resetPassword = vi.fn().mockResolvedValue({ ok: true });
    requestRecovery = vi.fn().mockResolvedValue(undefined);
    params = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
        { provide: PasswordService, useValue: { resetPassword, requestRecovery } },
        { provide: ReturnUrlService, useValue: { capture: vi.fn() } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResetPassword);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  async function submit(password: string) {
    const input = byId('reset-password-input') as HTMLInputElement;
    input.value = password;
    input.dispatchEvent(new Event('input'));
    byId('reset-password-submit')!.click();
    await settle();
  }

  it('não chama nenhum serviço ao ser criada (nem com link válido)', async () => {
    await create();
    expect(resetPassword).not.toHaveBeenCalled();
    expect(requestRecovery).not.toHaveBeenCalled();
    expect(byId('reset-password-input')).not.toBeNull();
    expect(byId('reset-password-invalid')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Crie uma nova senha');
  });

  describe('sem link válido', () => {
    it('sem token_hash mostra "Este link não vale mais" e os dois caminhos', async () => {
      await create({});
      expect(byId('reset-password-invalid')?.textContent).toContain('Este link não vale mais');
      expect(byId('reset-password-input')).toBeNull();
      expect(byId('reset-password-new-link')?.getAttribute('href')).toBe('/auth/recuperar-senha');
      expect(byId('reset-password-login')?.getAttribute('href')).toBe('/auth/login');
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('token_hash com type diferente de recovery também é link inválido', async () => {
      await create({ token_hash: 'x', type: 'email' });
      expect(byId('reset-password-invalid')).not.toBeNull();
    });
  });

  describe('validação', () => {
    it('senha de 7 caracteres não envia e pede 8', async () => {
      await create();
      await submit('1234567');
      expect(resetPassword).not.toHaveBeenCalled();
      expect(byId('reset-password-error')?.textContent).toContain('Use uma senha com pelo menos 8 caracteres.');
      expect(byId('reset-password-input')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('senha de 8 caracteres envia', async () => {
      await create();
      await submit('12345678');
      expect(resetPassword).toHaveBeenCalledWith('hash-do-link', '12345678');
    });

    it('senha de 73 caracteres não envia', async () => {
      await create();
      await submit('a'.repeat(73));
      expect(resetPassword).not.toHaveBeenCalled();
      expect(byId('reset-password-error')?.textContent).toContain('Use no máximo 72 caracteres.');
    });

    it('o aviso some quando a pessoa volta a digitar', async () => {
      await create();
      await submit('1234567');
      const input = byId('reset-password-input') as HTMLInputElement;
      input.value = '12345678';
      input.dispatchEvent(new Event('input'));
      await settle();
      expect(byId('reset-password-error')).toBeNull();
    });
  });

  it('o botão de olho alterna o tipo do campo e o rótulo', async () => {
    await create();
    const input = byId('reset-password-input') as HTMLInputElement;
    const toggle = byId('reset-password-toggle') as HTMLButtonElement;
    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
    toggle.click();
    await settle();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar senha');
  });

  describe('envio', () => {
    it('sucesso vai para /auth/login?senha=alterada', async () => {
      await create();
      await submit('NovaSenha123');
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { senha: 'alterada' },
        replaceUrl: true,
      });
    });

    it('invalid_link troca a tela para "Este link não vale mais" com "Pedir novo link"', async () => {
      await create();
      resetPassword.mockResolvedValue({ ok: false, reason: 'invalid_link' });
      await submit('NovaSenha123');
      expect(byId('reset-password-invalid')).not.toBeNull();
      expect(byId('reset-password-new-link')).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('weak_password do servidor mostra o aviso e mantém o formulário', async () => {
      await create();
      resetPassword.mockResolvedValue({ ok: false, reason: 'weak_password' });
      await submit('SenhaFraca1');
      expect(byId('reset-password-error')?.textContent).toContain('pelo menos 8 caracteres');
      expect(byId('reset-password-input')).not.toBeNull();
    });

    it('rede mostra o aviso de conexão e mantém o formulário para tentar de novo', async () => {
      await create();
      resetPassword.mockResolvedValue({ ok: false, reason: 'network' });
      await submit('NovaSenha123');
      expect(byId('reset-password-error')?.textContent).toContain('Não conseguimos conectar');
      expect(byId('reset-password-input')).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('um link novo na mesma tela recomeça do zero', async () => {
      await create();
      resetPassword.mockResolvedValue({ ok: false, reason: 'invalid_link' });
      await submit('NovaSenha123');
      expect(byId('reset-password-invalid')).not.toBeNull();
      params.next(convertToParamMap({ token_hash: 'outro', type: 'recovery' }));
      await settle();
      expect(byId('reset-password-input')).not.toBeNull();
    });
  });
});
