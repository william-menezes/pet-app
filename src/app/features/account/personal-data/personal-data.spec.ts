import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ZardSonnerService } from '@/shared/components/sonner';

import { AccountService } from '../../../core/account/account.service';
import { Account, AccountStore } from '../../../core/account/account.store';
import { PersonalData } from './personal-data';

const ACCOUNT: Account = {
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

describe('PersonalData', () => {
  let fixture: ComponentFixture<PersonalData>;
  let el: HTMLElement;
  let updateName: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;

  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const nameInput = () => byId('account-personal-name') as HTMLInputElement;
  const saveButton = () => byId('account-personal-save') as HTMLButtonElement;

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function create(over: { account?: Account | null } = {}) {
    const account = over.account === undefined ? ACCOUNT : over.account;
    updateName = vi.fn().mockResolvedValue({ ok: true });
    success = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AccountService, useValue: { ensureLoaded: vi.fn().mockResolvedValue(account), updateName } },
        { provide: ZardSonnerService, useValue: { success } },
      ],
    });
    if (account) TestBed.inject(AccountStore).set(account);
    fixture = TestBed.createComponent(PersonalData);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await settle();
  }

  async function type(value: string) {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
    await settle();
  }

  async function save() {
    saveButton().click();
    await settle();
    await settle();
  }

  it('mostra o nome atual, o e-mail somente leitura com a ajuda e os data-testid do contrato', async () => {
    await create();
    expect(nameInput().value).toBe('Ana Souza');
    const email = byId('account-personal-email') as HTMLInputElement;
    expect(email.value).toBe('ana@email.com');
    expect(email.readOnly).toBe(true);
    expect(el.textContent).toContain('O e-mail não pode ser alterado por aqui.');
    expect(saveButton()).not.toBeNull();
  });

  it('"Salvar alterações" começa desabilitado, habilita com mudança e desabilita ao voltar ao valor original', async () => {
    await create();
    expect(saveButton().disabled).toBe(true);
    await type('Ana Maria Souza');
    expect(saveButton().disabled).toBe(false);
    await type('Ana Souza');
    expect(saveButton().disabled).toBe(true);
  });

  it('espaços nas pontas não contam como mudança', async () => {
    await create();
    await type('  Ana Souza  ');
    expect(saveButton().disabled).toBe(true);
  });

  it('1 caractere: não chama o servidor e mostra o erro do campo', async () => {
    await create();
    await type('A');
    await save();
    expect(updateName).not.toHaveBeenCalled();
    expect(byId('account-personal-name-error')?.textContent).toContain('Use entre 2 e 80 caracteres.');
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('nome vazio (só espaços) pede o nome', async () => {
    await create();
    await type('   ');
    await save();
    expect(updateName).not.toHaveBeenCalled();
    expect(byId('account-personal-name-error')?.textContent).toContain('Informe seu nome.');
  });

  it('2 caracteres e 80 caracteres salvam', async () => {
    await create();
    await type('Jo');
    await save();
    expect(updateName).toHaveBeenLastCalledWith('Jo');
    await type('a'.repeat(80));
    await save();
    expect(updateName).toHaveBeenLastCalledWith('a'.repeat(80));
    expect(updateName).toHaveBeenCalledTimes(2);
  });

  it('81 caracteres: não chama o servidor e mostra o erro', async () => {
    await create();
    await type('a'.repeat(81));
    await save();
    expect(updateName).not.toHaveBeenCalled();
    expect(byId('account-personal-name-error')?.textContent).toContain('Use entre 2 e 80 caracteres.');
  });

  it('sucesso: avisa "Dados salvos." pelo sonner e volta o botão a desabilitado', async () => {
    await create();
    // o serviço real recarrega a conta; aqui o store ganha o nome novo, como acontece depois do load
    updateName.mockImplementation(async (nome: string) => {
      TestBed.inject(AccountStore).set({ ...ACCOUNT, nome });
      return { ok: true };
    });
    await type('  Ana Maria  ');
    await save();
    expect(updateName).toHaveBeenCalledWith('Ana Maria');
    expect(success).toHaveBeenCalledWith('Dados salvos.');
    expect(byId('account-personal-saved')).not.toBeNull();
    expect(nameInput().value).toBe('Ana Maria');
    expect(saveButton().disabled).toBe(true);
  });

  it('falha de rede mostra o aviso e mantém o que foi digitado', async () => {
    await create();
    updateName.mockResolvedValue({ ok: false, reason: 'network' });
    await type('Ana Maria');
    await save();
    expect(byId('account-personal-error')?.textContent).toContain('Não conseguimos conectar.');
    expect(success).not.toHaveBeenCalled();
    expect(nameInput().value).toBe('Ana Maria');
    expect(saveButton().disabled).toBe(false);
  });

  it('o nome carregado depois entra no campo se a pessoa ainda não digitou', async () => {
    await create({ account: null });
    expect(nameInput().value).toBe('');
    TestBed.inject(AccountStore).set(ACCOUNT);
    await settle();
    expect(nameInput().value).toBe('Ana Souza');
  });
});
