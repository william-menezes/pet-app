import { codeFromQr } from './qr-payload';
import { tagUrl } from './tag-code';

// Código sintético do contrato (tag-code.vectors.json): válido pela regra.
const CODE = '7K3MQ9XAC';

describe('codeFromQr (T072)', () => {
  it('lê o que a etiqueta imprime: HTTPS://<domínio>/<CÓDIGO>', () => {
    expect(codeFromQr(tagUrl(CODE))).toBe(CODE);
  });

  it('aceita o mesmo endereço em minúsculas, com espaços em volta, barra no fim, consulta e fragmento', () => {
    expect(codeFromQr('https://tagfaro.com.br/7k3mq9xac')).toBe(CODE);
    expect(codeFromQr(`  ${tagUrl(CODE)}  `)).toBe(CODE);
    expect(codeFromQr(`${tagUrl(CODE)}/`)).toBe(CODE);
    expect(codeFromQr(`${tagUrl(CODE)}?origem=qr#x`)).toBe(CODE);
  });

  it('normaliza o código como toda entrada (hífen, espaço e letras parecidas)', () => {
    expect(codeFromQr('https://tagfaro.com.br/7K3M-Q9XA-C')).toBe(CODE);
    expect(codeFromQr('https://tagfaro.com.br/7K3M%20Q9XA%20C')).toBe(CODE);
  });

  it('outro domínio, subdomínio, usuário@ e porta não são uma tag do Faro', () => {
    for (const text of [
      `https://evil.example/${CODE}`,
      `https://www.tagfaro.com.br/${CODE}`,
      `https://tagfaro.com.br.evil.example/${CODE}`,
      `https://tagfaro.com.br@evil.example/${CODE}`,
      `https://tagfaro.com.br:8443/${CODE}`,
      `https://tagfaro.com.br./${CODE}`,
      `https://evil.example/https://tagfaro.com.br/${CODE}`,
    ]) {
      expect(codeFromQr(text), text).toBeNull();
    }
  });

  it('só HTTPS', () => {
    expect(codeFromQr(`http://tagfaro.com.br/${CODE}`)).toBeNull();
    expect(codeFromQr(`javascript:alert(1)//tagfaro.com.br/${CODE}`)).toBeNull();
    expect(codeFromQr(`ftp://tagfaro.com.br/${CODE}`)).toBeNull();
  });

  it('dígito errado, tamanho errado, mais de um segmento e caminho vazio', () => {
    expect(codeFromQr('https://tagfaro.com.br/7K3MQ9XAD')).toBeNull();
    expect(codeFromQr('https://tagfaro.com.br/7K3MQ9XA')).toBeNull();
    expect(codeFromQr(`https://tagfaro.com.br/app/${CODE}`)).toBeNull();
    expect(codeFromQr('https://tagfaro.com.br/')).toBeNull();
    expect(codeFromQr('https://tagfaro.com.br')).toBeNull();
  });

  it('texto que não é endereço, vazio ou com escape quebrado devolve null sem lançar', () => {
    expect(codeFromQr('')).toBeNull();
    expect(codeFromQr(CODE)).toBeNull();
    expect(codeFromQr('Olá, mundo')).toBeNull();
    expect(codeFromQr('https://tagfaro.com.br/%E0%A4%A')).toBeNull();
  });
});
