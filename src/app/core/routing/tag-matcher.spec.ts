import { UrlSegment } from '@angular/router';

import { headerKindForPath } from '../../../security-headers';
import { format } from '../tag-code/tag-code';
import { looksLikeTagCode, tagCodeMatcher } from './tag-matcher';

const seg = (...paths: string[]) => paths.map((path) => new UrlSegment(path, {}));

describe('tagCodeMatcher (T024)', () => {
  it.each(['7K3MQ9XAC', '7K3M-Q9XA-C', '7k3m-q9xa-c', '7k3m q9xa c', 'OIL0-1111-1'])('casa %s', (path) => {
    const result = tagCodeMatcher(seg(path), {} as never, {} as never);
    expect(result?.consumed).toHaveLength(1);
    expect(result?.posParams?.['codigo'].path).toBe(path);
  });

  it.each(['qualquer-coisa', 'app', 'novo-pet', '7K3MQ9XA', '7K3MQ9XACX', 'U2345678X', '', '7K3M?Q9XAC'])(
    'não casa %j',
    (path) => {
      expect(tagCodeMatcher(seg(path), {} as never, {} as never)).toBeNull();
    },
  );

  it('só casa com um segmento', () => {
    expect(tagCodeMatcher(seg('7K3MQ9XAC', 'perdido'), {} as never, {} as never)).toBeNull();
    expect(tagCodeMatcher([], {} as never, {} as never)).toBeNull();
  });

  it('o dígito verificador não é conferido aqui: dígito errado casa e a página mostra "não encontrada"', () => {
    expect(looksLikeTagCode('7K3MQ9XAD')).toBe(true);
  });

  it('todo caminho que o matcher aceita recebe a política "tag" de cabeçalhos', () => {
    const accepted = [
      '7K3MQ9XAC',
      format('7K3MQ9XAC'),
      '7k3mq9xac',
      '7k3m-q9xa-c',
      '7k3m%20q9xa%20c',
      '7K3M%20Q9XA%20C',
      '7K3M-Q9XA-C',
    ];
    for (const path of accepted) {
      const decoded = decodeURIComponent(path);
      expect(looksLikeTagCode(decoded), decoded).toBe(true);
      expect(headerKindForPath(`/${path}`), path).toBe('tag');
      expect(headerKindForPath(`/${path}/`), `${path}/`).toBe('tag');
    }
  });
});
