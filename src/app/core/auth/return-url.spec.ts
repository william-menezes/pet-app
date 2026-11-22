import { TestBed } from '@angular/core/testing';
import { ReturnUrlService, sanitizeReturnUrl } from './return-url';

describe('sanitizeReturnUrl (tabela do contrato §3)', () => {
  const valid = ['/ativar/7K3M-Q9XA-C', '/app/conta/celular', '/app?x=1#y'];
  for (const input of valid) {
    it(`aceita ${input}`, () => {
      expect(sanitizeReturnUrl(input)).toBe(input);
    });
  }

  const invalid: [string, unknown][] = [
    ['//evil.com', '//evil.com'],
    ['/\\evil.com', '/\\evil.com'],
    ['https://evil.com/app', 'https://evil.com/app'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['/auth/login', '/auth/login'],
    ['app', 'app'],
    ['string vazia', ''],
    ['null', null],
    ['número 42', 42],
    ['string com 201 caracteres', '/' + 'a'.repeat(200)],
  ];
  for (const [name, input] of invalid) {
    it(`recusa ${name}`, () => {
      expect(sanitizeReturnUrl(input)).toBeNull();
    });
  }

  it('aceita string com exatamente 200 caracteres', () => {
    const s = '/' + 'a'.repeat(199);
    expect(sanitizeReturnUrl(s)).toBe(s);
  });

  it('recusa /auth sozinho e /auth/ com subcaminho, mas não /authors', () => {
    expect(sanitizeReturnUrl('/auth')).toBeNull();
    expect(sanitizeReturnUrl('/auth/termos?returnUrl=/app')).toBeNull();
    expect(sanitizeReturnUrl('/authors')).toBe('/authors');
  });

  it('recusa "@" no primeiro segmento e caracteres de controle', () => {
    expect(sanitizeReturnUrl('/@evil.com')).toBeNull();
    expect(sanitizeReturnUrl('/app\n/x')).toBeNull();
    expect(sanitizeReturnUrl('/app\u007f')).toBeNull();
    expect(sanitizeReturnUrl('/app/a@b')).toBe('/app/a@b');
  });
});

describe('ReturnUrlService', () => {
  let service: ReturnUrlService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReturnUrlService);
  });

  afterEach(() => sessionStorage.clear());

  it('capture grava o valor válido e peek o devolve sem apagar', () => {
    service.capture('/app/conta');
    expect(service.peek()).toBe('/app/conta');
    expect(service.peek()).toBe('/app/conta');
  });

  it('consume lê e apaga', () => {
    service.capture('/app/conta');
    expect(service.consume()).toBe('/app/conta');
    expect(service.peek()).toBeNull();
  });

  it('capture ignora valor inválido e mantém o anterior', () => {
    service.capture('/app');
    service.capture('//evil.com');
    expect(service.peek()).toBe('/app');
  });

  it('peek revalida o que está no storage', () => {
    sessionStorage.setItem('faro.returnUrl', 'https://evil.com');
    expect(service.peek()).toBeNull();
  });

  it('clear apaga', () => {
    service.capture('/app');
    service.clear();
    expect(service.peek()).toBeNull();
  });

  it('storage lançando erro não quebra', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => service.capture('/app')).not.toThrow();
    spy.mockRestore();
    const spy2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(service.peek()).toBeNull();
    spy2.mockRestore();
  });
});
