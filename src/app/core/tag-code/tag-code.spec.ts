import { TAG_ALPHABET, TAG_DOMAIN, checkDigit, format, isValid, newCode, normalize, tagUrl } from './tag-code';

/** Fonte de bytes para os testes de propriedade (Web Crypto existe no Node e no jsdom). */
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

describe('tag-code: tabela de casos do contrato', () => {
  const cases: { entrada: string; normalizado: string; valido: boolean }[] = [
    { entrada: '7K3M-Q9XA-C', normalizado: '7K3MQ9XAC', valido: true },
    { entrada: '7k3m q9xa c', normalizado: '7K3MQ9XAC', valido: true },
    { entrada: '7K3M-Q9XA-D', normalizado: '7K3MQ9XAD', valido: false },
    { entrada: 'OIL0-1111-?', normalizado: '01101111?', valido: false },
    { entrada: '7K3MQ9XA', normalizado: '7K3MQ9XA', valido: false },
    { entrada: '7K3MQ9XACX', normalizado: '7K3MQ9XACX', valido: false },
    { entrada: '', normalizado: '', valido: false },
    { entrada: 'U2345678X', normalizado: 'U2345678X', valido: false },
  ];

  for (const c of cases) {
    it(`normalize("${c.entrada}") = "${c.normalizado}"`, () => {
      expect(normalize(c.entrada)).toBe(c.normalizado);
    });
    it(`isValid("${c.entrada}") = ${c.valido}`, () => {
      expect(isValid(c.entrada)).toBe(c.valido);
    });
  }

  it('normaliza O, I e L (qualquer caixa) e tira so hifen e espacos ASCII', () => {
    expect(normalize('oOiIlL')).toBe('001111');
    expect(normalize(' 7k3m-q9xa-c ')).toBe('7K3MQ9XAC');
    expect(normalize('7K3M\t-Q9XA\n-C\r')).toBe('7K3MQ9XAC');
  });

  it('nao faz dobra de caixa Unicode (o SQL so troca a-z)', () => {
    // 'ß' viraria 'SS' com toUpperCase(); aqui continua um caractere fora do alfabeto.
    expect(normalize('ß')).toBe('ß');
    expect(isValid('ZZZZZZZß')).toBe(false);
    expect(isValid('7K3M Q9XAC')).toBe(false); // espaco nao-ASCII nao e removido
  });

  it('entrada que nao e texto nunca e valida', () => {
    expect(isValid(undefined as unknown as string)).toBe(false);
    expect(isValid(null as unknown as string)).toBe(false);
  });
});

describe('tag-code: checkDigit, format, tagUrl', () => {
  it('checkDigit de 7K3MQ9XA e C', () => {
    expect(checkDigit('7K3MQ9XA')).toBe('C');
  });

  it('checkDigit recusa corpo que nao tem 8 caracteres do alfabeto', () => {
    expect(() => checkDigit('7K3MQ9X')).toThrow(RangeError);
    expect(() => checkDigit('7K3MQ9XAC')).toThrow(RangeError);
    expect(() => checkDigit('7K3MQ9XU')).toThrow(RangeError);
    expect(() => checkDigit('7k3mq9xa')).toThrow(RangeError);
  });

  it('format aceita qualquer entrada valida e devolve XXXX-XXXX-X', () => {
    expect(format('7k3mq9xac')).toBe('7K3M-Q9XA-C');
    expect(format('7K3M-Q9XA-C')).toBe('7K3M-Q9XA-C');
  });

  it('format lanca erro se invalida', () => {
    expect(() => format('7K3M-Q9XA-D')).toThrow(RangeError);
    expect(() => format('')).toThrow(RangeError);
  });

  it('tagUrl monta a URL em maiusculas, sem hifens, so no dominio do contrato', () => {
    expect(TAG_DOMAIN).toBe('TAGFARO.COM.BR');
    expect(tagUrl('7k3m-q9xa-c')).toBe('HTTPS://TAGFARO.COM.BR/7K3MQ9XAC');
    expect(() => tagUrl('7K3M-Q9XA-D')).toThrow(RangeError);
  });

  it('o alfabeto e o Crockford Base32 do contrato', () => {
    expect(TAG_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
    expect(TAG_ALPHABET).toHaveLength(32);
  });
});

describe('tag-code: propriedade (10.000 corpos aleatorios)', () => {
  it('corpo + checkDigit e sempre valido; trocar um caractere qualquer o invalida', () => {
    for (let n = 0; n < 10_000; n++) {
      const code = newCode(randomBytes);
      expect(code).toHaveLength(9);
      expect(isValid(code)).toBe(true);
      expect(isValid(code.slice(0, 8) + checkDigit(code.slice(0, 8)))).toBe(true);

      const pos = n % 9;
      let other = TAG_ALPHABET[randomBytes(1)[0] & 31];
      if (other === code[pos]) other = TAG_ALPHABET[(TAG_ALPHABET.indexOf(other) + 1) % 32];
      const changed = code.slice(0, pos) + other + code.slice(pos + 1);
      expect(isValid(changed)).toBe(false);
    }
  });

  it('exaustivo em um codigo: nenhuma das 9 x 31 trocas de um caractere e valida', () => {
    const code = '7K3MQ9XAC';
    let tested = 0;
    for (let pos = 0; pos < 9; pos++) {
      for (const ch of TAG_ALPHABET) {
        if (ch === code[pos]) continue;
        expect(isValid(code.slice(0, pos) + ch + code.slice(pos + 1))).toBe(false);
        tested++;
      }
    }
    expect(tested).toBe(9 * 31);
  });

  it('newCode e deterministico para uma fonte de bytes fixa e recusa fonte curta', () => {
    const fixed = () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(newCode(fixed)).toBe(newCode(fixed));
    expect(newCode(fixed).slice(0, 8)).toBe('01234567');
    // byte & 31: 32 -> '0', 255 -> 'Z'
    expect(newCode(() => Uint8Array.from([32, 255, 0, 0, 0, 0, 0, 0])).slice(0, 2)).toBe('0Z');
    expect(() => newCode(() => new Uint8Array(3))).toThrow(RangeError);
  });
});
