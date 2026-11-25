import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccountService } from '../../../core/account/account.service';
import { Account, AccountStore } from '../../../core/account/account.store';
import { AccountPhone } from './phone';

const CONFIRMED: Account = {
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

describe('AccountPhone', () => {
  let fixture: ComponentFixture<AccountPhone>;
  let el: HTMLElement;
  let load: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(account: Account | null) {
    load = vi.fn().mockResolvedValue(account);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AccountService, useValue: { ensureLoaded: vi.fn().mockResolvedValue(account), load } },
      ],
    });
    if (account) TestBed.inject(AccountStore).set(account);
    fixture = TestBed.createComponent(AccountPhone);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  const href = (id: string) => byId(id)!.getAttribute('href');

  it('confirmado: número, selo, data e "Trocar celular" para /auth/celular com returnUrl', async () => {
    await create(CONFIRMED);
    expect(byId('account-phone-number')?.textContent).toBe('(11) 98765-4421');
    expect(byId('account-phone-status')?.textContent?.trim()).toBe('Confirmado');
    expect(byId('account-phone-confirmed-on')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Confirmado em 02 nov 2026',
    );
    expect(href('account-phone-change')).toBe('/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular');
    expect(byId('account-phone-confirm')).toBeNull();
    expect(byId('account-phone-pending')).toBeNull();
    expect(el.textContent).toContain('abre uma conversa com você no WhatsApp');
  });

  it('não confirmado, com o número do cadastro: aviso, selo neutro e "Confirmar celular"', async () => {
    await create({ ...CONFIRMED, celular: null, celularConfirmadoEm: null, celularPendente: '+5511987654421' });
    expect(byId('account-phone-notice')?.textContent).toContain(
      'Seu celular ainda não foi confirmado. Sem isso, não dá para ativar uma tag.',
    );
    expect(byId('account-phone-number')?.textContent).toBe('(11) 98765-4421');
    expect(byId('account-phone-status')?.textContent?.trim()).toBe('Não confirmado');
    expect(el.textContent).toContain('Informado no cadastro');
    expect(href('account-phone-confirm')).toBe('/auth/celular?returnUrl=%2Fapp%2Fconta%2Fcelular');
    expect(byId('account-phone-change')).toBeNull();
  });

  it('não confirmado e sem número nenhum: diz que não há número e oferece "Confirmar celular"', async () => {
    await create({ ...CONFIRMED, celular: null, celularConfirmadoEm: null, celularPendente: null });
    expect(byId('account-phone-none')).not.toBeNull();
    expect(byId('account-phone-confirm')).not.toBeNull();
  });

  it('troca pendente: mantém o número confirmado, mostra o aguardado e "Continuar"', async () => {
    await create({ ...CONFIRMED, celularPendente: '+5521999998888' });
    expect(byId('account-phone-number')?.textContent).toBe('(11) 98765-4421');
    expect(byId('account-phone-status')?.textContent?.trim()).toBe('Confirmado');
    expect(byId('account-phone-pending')?.textContent).toContain('Aguardando confirmação de (21) 99999-8888');
    expect(href('account-phone-continue')).toBe('/auth/confirmar-celular?returnUrl=%2Fapp%2Fconta%2Fcelular');
    expect(byId('account-phone-change')).toBeNull();
    expect(byId('account-phone-confirm')).toBeNull();
  });

  it('pendente igual ao confirmado não é troca pendente', async () => {
    await create({ ...CONFIRMED, celularPendente: '+5511987654421' });
    expect(byId('account-phone-pending')).toBeNull();
    expect(byId('account-phone-change')).not.toBeNull();
  });

  it('conta que não carregou termina em aviso com "Tentar de novo"', async () => {
    await create(null);
    expect(byId('account-phone-load-error')).not.toBeNull();
    byId('account-phone-retry')!.click();
    await settle();
    expect(load).toHaveBeenCalledWith(true);
  });
});
