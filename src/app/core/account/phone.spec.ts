import { formatBrPhone, maskBrPhoneInput, normalizeBrPhone } from './phone';

describe('normalizeBrPhone (tabela do contrato shared-edge)', () => {
  const cases: [string, unknown, string | null][] = [
    ['máscara completa', '(11) 98765-4421', '+5511987654421'],
    ['só dígitos', '11987654421', '+5511987654421'],
    ['com +55 e espaços', '+55 11 98765-4421', '+5511987654421'],
    ['com 55 sem +', '5511987654421', '+5511987654421'],
    ['fixo', '(11) 3765-4421', null],
    ['DDD inválido', '(01) 98765-4421', null],
    ['outro país', '+1 415 555 0100', null],
    ['sem DDD', '987654421', null],
    ['vazio', '', null],
    ['null', null, null],
    ['número', 123, null],
  ];
  for (const [name, input, out] of cases) {
    it(name, () => {
      expect(normalizeBrPhone(input)).toBe(out);
    });
  }
});

describe('formatBrPhone', () => {
  it('formata E.164', () => {
    expect(formatBrPhone('+5511987654421')).toBe('(11) 98765-4421');
  });
  it('devolve a entrada se não for E.164 de celular', () => {
    expect(formatBrPhone('abc')).toBe('abc');
  });
});

describe('maskBrPhoneInput', () => {
  it('aplica a máscara por etapas', () => {
    expect(maskBrPhoneInput('')).toBe('');
    expect(maskBrPhoneInput('1')).toBe('(1');
    expect(maskBrPhoneInput('11')).toBe('(11');
    expect(maskBrPhoneInput('119')).toBe('(11) 9');
    expect(maskBrPhoneInput('1198765')).toBe('(11) 98765');
    expect(maskBrPhoneInput('11987654')).toBe('(11) 98765-4');
    expect(maskBrPhoneInput('11987654421')).toBe('(11) 98765-4421');
  });
  it('corta o excesso e ignora o que não é dígito', () => {
    expect(maskBrPhoneInput('(11) 98765-4421999')).toBe('(11) 98765-4421');
  });
  it('aceita colar com +55', () => {
    expect(maskBrPhoneInput('+55 11 98765-4421')).toBe('(11) 98765-4421');
  });
});
