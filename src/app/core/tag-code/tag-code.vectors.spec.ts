/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TAG_ALPHABET, checkDigit, format, isValid, normalize } from './tag-code';

/**
 * T011: teste cruzado contra os vetores SINTETICOS versionados (nenhum e codigo real). O mesmo arquivo
 * alimenta `supabase/tests/tag_code.test.sql`. Contrato: specs/003-tag-qr/contracts/tag-code.contract.md.
 */
interface Vectors {
  alphabet: string;
  valid: { body: string; check: string; code: string; display: string }[];
  invalid: string[];
  normalize: [string, string][];
}

const root = process.cwd();
const vectors = JSON.parse(
  readFileSync(resolve(root, 'src/app/core/tag-code/fixtures/tag-code.vectors.json'), 'utf8'),
) as Vectors;

describe('tag-code: vetores sinteticos versionados', () => {
  it('o arquivo tem o alfabeto do contrato e casos suficientes', () => {
    expect(vectors.alphabet).toBe(TAG_ALPHABET);
    expect(vectors.valid.length).toBeGreaterThanOrEqual(40);
    expect(vectors.invalid.length).toBeGreaterThanOrEqual(30);
    expect(vectors.normalize.length).toBeGreaterThanOrEqual(5);
  });

  it('para cada valid: checkDigit(body) devolve check, isValid(code) e true e format confere', () => {
    for (const v of vectors.valid) {
      expect(checkDigit(v.body), `checkDigit(${v.body})`).toBe(v.check);
      expect(v.code).toBe(v.body + v.check);
      expect(isValid(v.code), `isValid(${v.code})`).toBe(true);
      expect(isValid(v.display), `isValid(${v.display})`).toBe(true);
      expect(format(v.code)).toBe(v.display);
    }
  });

  it('cada invalid e falso', () => {
    for (const code of vectors.invalid) {
      expect(isValid(code), `isValid(${JSON.stringify(code)})`).toBe(false);
    }
  });

  it('cada par de normalize confere', () => {
    for (const [entrada, esperado] of vectors.normalize) {
      expect(normalize(entrada), `normalize(${JSON.stringify(entrada)})`).toBe(esperado);
    }
  });
});

/**
 * So local: os 54 codigos reais do lote-001 ficam em `tools/tag-generator/lote-001/codes.txt`, FORA do git
 * (o repositorio e publico). No CI o arquivo nao existe e o teste e pulado. Nunca copie codigos do lote
 * para arquivo versionado.
 */
const LOTE_FILE = resolve(root, 'tools/tag-generator/lote-001/codes.txt');
const loteExiste = existsSync(LOTE_FILE);

describe('tag-code: lote-001 real (so onde o arquivo existe)', () => {
  it.skipIf(!loteExiste)(
    loteExiste ? 'os 54 codigos do lote-001 passam em isValid' : 'lote-001 ausente (arquivo fora do git)',
    () => {
      const linhas = readFileSync(LOTE_FILE, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      expect(linhas).toHaveLength(54);
      linhas.forEach((linha, i) => {
        expect(isValid(linha), `codigo ${i + 1} do lote`).toBe(true);
      });
    },
  );
});
