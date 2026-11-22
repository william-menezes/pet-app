import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../auth/auth.store';
import { ReturnUrlService } from '../auth/return-url';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountStore } from './account.store';
import { PrivacyService, exportFileName } from './privacy.service';

const EXPORT = {
  formato: 1,
  gerado_em: '2026-11-21T12:30:00Z',
  conta: { id: 'u1', email: 'ana@email.com' },
  consentimentos: [],
  eventos: [],
  tags_e_pets: null,
  observacoes: ['Dados de pets, tags e scans ainda não estão disponíveis nesta exportação.'],
};

describe('exportFileName', () => {
  it('usa faro-meus-dados-AAAA-MM-DD.json com a data local', () => {
    expect(exportFileName(new Date(2026, 10, 22, 23, 59))).toBe('faro-meus-dados-2026-11-22.json');
    expect(exportFileName(new Date(2026, 0, 5, 0, 1))).toBe('faro-meus-dados-2026-01-05.json');
  });
});

describe('PrivacyService', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let invoke: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let authStoreReset: ReturnType<typeof vi.fn>;
  let accountStoreReset: ReturnType<typeof vi.fn>;
  let clearReturnUrl: ReturnType<typeof vi.fn>;
  let service: PrivacyService;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let downloads: { name: string; href: string }[];
  let blobs: Blob[];

  beforeEach(() => {
    vi.useFakeTimers();
    rpc = vi.fn().mockResolvedValue({ data: EXPORT, error: null });
    invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    signOut = vi.fn().mockResolvedValue({ error: null });
    authStoreReset = vi.fn();
    accountStoreReset = vi.fn();
    clearReturnUrl = vi.fn();

    blobs = [];
    downloads = [];
    createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      blobs.push(blob);
      return 'blob:faro-teste';
    });
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });

    localStorage.setItem('faro.returning', '1');

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc, functions: { invoke }, auth: { signOut } } } },
        { provide: AuthStore, useValue: { reset: authStoreReset } },
        { provide: AccountStore, useValue: { reset: accountStoreReset } },
        { provide: ReturnUrlService, useValue: { clear: clearReturnUrl } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(PrivacyService);
  });

  afterEach(() => {
    clickSpy.mockRestore();
    vi.useRealTimers();
    localStorage.removeItem('faro.returning');
  });

  describe('exportData', () => {
    it('chama a RPC, baixa o JSON com o nome do dia e revoga o endereço em seguida', async () => {
      vi.setSystemTime(new Date(2026, 10, 22, 10, 0));
      const result = await service.exportData();
      expect(result).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('export_my_data');
      expect(downloads).toEqual([{ name: 'faro-meus-dados-2026-11-22.json', href: 'blob:faro-teste' }]);
      expect(blobs[0].type).toBe('application/json');
      expect(JSON.parse(await blobs[0].text())).toEqual(EXPORT);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:faro-teste');
    });

    it('o JSON sai indentado (2 espaços) e o link temporário não fica na página', async () => {
      await service.exportData();
      expect(await blobs[0].text()).toBe(JSON.stringify(EXPORT, null, 2));
      expect(document.querySelector('a[download]')).toBeNull();
    });

    it('rate_limited devolve os segundos em retryAfterSeconds e não baixa nada', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'rate_limited', details: '5400' } });
      const result = await service.exportData();
      expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 5400 });
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(downloads).toEqual([]);
    });

    it('rate_limited sem segundos legíveis não inventa o tempo', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'rate_limited', details: null } });
      expect(await service.exportData()).toEqual({ ok: false, reason: 'rate_limited' });
    });

    it('not_authenticated, outro erro e falha de rede viram network', async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_authenticated', details: '' } });
      expect(await service.exportData()).toEqual({ ok: false, reason: 'network' });
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom', details: '' } });
      expect(await service.exportData()).toEqual({ ok: false, reason: 'network' });
      rpc.mockRejectedValueOnce(new Error('Failed to fetch'));
      expect(await service.exportData()).toEqual({ ok: false, reason: 'network' });
      expect(downloads).toEqual([]);
    });

    it('resposta vazia não gera arquivo', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      expect(await service.exportData()).toEqual({ ok: false, reason: 'network' });
      expect(downloads).toEqual([]);
    });

    it('não guarda o conteúdo exportado: o serviço só tem as dependências injetadas', async () => {
      await service.exportData();
      expect(Object.keys(service).sort()).toEqual([
        'accountStore',
        'authStore',
        'document',
        'platformId',
        'returnUrl',
        'supabase',
      ]);
    });
  });

  describe('deleteAccount', () => {
    it('envia { confirm: "EXCLUIR", password } para account-delete', async () => {
      await service.deleteAccount({ password: 'SenhaSegura1' });
      expect(invoke).toHaveBeenCalledWith('account-delete', {
        body: { confirm: 'EXCLUIR', password: 'SenhaSegura1' },
      });
    });

    it('conta só com o Google: não envia a senha', async () => {
      await service.deleteAccount({});
      expect(invoke).toHaveBeenCalledWith('account-delete', { body: { confirm: 'EXCLUIR' } });
    });

    it('sucesso: encerra a sessão local, zera os stores e apaga as marcas locais', async () => {
      sessionStorage.setItem('faro.returnUrl', '/app');
      const result = await service.deleteAccount({ password: 'SenhaSegura1' });
      expect(result).toEqual({ ok: true });
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(authStoreReset).toHaveBeenCalledTimes(1);
      expect(accountStoreReset).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('faro.returning')).toBeNull();
      expect(clearReturnUrl).toHaveBeenCalledTimes(1);
      sessionStorage.removeItem('faro.returnUrl');
    });

    it('um erro no signOut local não impede a limpeza', async () => {
      signOut.mockRejectedValue(new Error('401'));
      expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: true });
      expect(authStoreReset).toHaveBeenCalled();
      expect(localStorage.getItem('faro.returning')).toBeNull();
    });

    const semLimpeza = async () => {
      expect(signOut).not.toHaveBeenCalled();
      expect(authStoreReset).not.toHaveBeenCalled();
      expect(accountStoreReset).not.toHaveBeenCalled();
      expect(localStorage.getItem('faro.returning')).toBe('1');
      expect(clearReturnUrl).not.toHaveBeenCalled();
    };

    for (const error of [
      'confirmation_required',
      'invalid_password',
      'deletion_unavailable',
      'deletion_incomplete',
    ] as const) {
      it(`${error} é repassado e não limpa nada`, async () => {
        invoke.mockResolvedValue({ data: { ok: false, error }, error: null });
        expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: false, error });
        await semLimpeza();
      });
    }

    it('reauth_required traz o método (senha ou Google)', async () => {
      invoke.mockResolvedValueOnce({ data: { ok: false, error: 'reauth_required', method: 'password' }, error: null });
      expect(await service.deleteAccount({})).toEqual({ ok: false, error: 'reauth_required', method: 'password' });
      invoke.mockResolvedValueOnce({ data: { ok: false, error: 'reauth_required', method: 'google' }, error: null });
      expect(await service.deleteAccount({})).toEqual({ ok: false, error: 'reauth_required', method: 'google' });
      await semLimpeza();
    });

    it('rate_limited traz retry_after_seconds como retryAfterSeconds', async () => {
      invoke.mockResolvedValue({ data: { ok: false, error: 'rate_limited', retry_after_seconds: 840 }, error: null });
      expect(await service.deleteAccount({ password: 'x' })).toEqual({
        ok: false,
        error: 'rate_limited',
        retryAfterSeconds: 840,
      });
      await semLimpeza();
    });

    it('401, erro de transporte, exceção e corpo desconhecido viram network', async () => {
      invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsHttpError' } });
      expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: false, error: 'network' });
      invoke.mockRejectedValueOnce(new Error('Failed to fetch'));
      expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValueOnce({ data: { ok: false, error: 'algo_novo' }, error: null });
      expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: false, error: 'network' });
      invoke.mockResolvedValueOnce({ data: 'texto', error: null });
      expect(await service.deleteAccount({ password: 'x' })).toEqual({ ok: false, error: 'network' });
      await semLimpeza();
    });
  });
});
