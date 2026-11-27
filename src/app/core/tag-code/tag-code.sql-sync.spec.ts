/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * T021: `supabase/tests/tag_code.test.sql` embute os vetores sinteticos (o pgTAP nao le arquivo do repositorio).
 * Este teste garante que o bloco embutido diz exatamente o mesmo que `fixtures/tag-code.vectors.json`: se alguem
 * editar so um dos dois, o TypeScript e o SQL deixam de ser testados contra a mesma tabela de casos.
 */
interface Vectors {
  valid: { body: string; check: string; code: string; display: string }[];
  invalid: string[];
  normalize: [string, string][];
}

const root = process.cwd();
const vectors = JSON.parse(
  readFileSync(resolve(root, 'src/app/core/tag-code/fixtures/tag-code.vectors.json'), 'utf8'),
) as Vectors;
const sql = readFileSync(resolve(root, 'supabase/tests/tag_code.test.sql'), 'utf8');

/** Linhas `('a', 'b', ...)` do INSERT da tabela `table`, com `''` desfeito. */
function rowsOf(block: string, table: string): string[][] {
  const start = block.indexOf(`INSERT INTO ${table} VALUES`);
  expect(start, `INSERT INTO ${table} existe no bloco`).toBeGreaterThanOrEqual(0);
  const end = block.indexOf(';', start);
  const body = block.slice(start, end);
  const rows: string[][] = [];
  for (const tuple of body.matchAll(/\(((?:'(?:[^']|'')*'(?:,\s*)?)+)\)/g)) {
    const cells = [...tuple[1].matchAll(/'((?:[^']|'')*)'/g)].map((c) => c[1].replace(/''/g, "'"));
    rows.push(cells);
  }
  return rows;
}

describe('tag_code.test.sql: o bloco de vetores acompanha o JSON', () => {
  const from = sql.indexOf('-- >>> vetores');
  const to = sql.indexOf('-- <<< vetores');
  const block = sql.slice(from, to);

  it('o bloco existe', () => {
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
  });

  it('valid: body, digito, code e forma de exibicao iguais, na mesma ordem', () => {
    expect(rowsOf(block, 'v_valid')).toEqual(vectors.valid.map((v) => [v.body, v.check, v.code, v.display]));
  });

  it('invalid: as mesmas entradas, na mesma ordem', () => {
    expect(rowsOf(block, 'v_invalid')).toEqual(vectors.invalid.map((v) => [v]));
  });

  it('normalize: os mesmos pares, na mesma ordem', () => {
    expect(rowsOf(block, 'v_norm')).toEqual(vectors.normalize);
  });

  it('as contagens do plano do teste SQL batem com o JSON', () => {
    expect(sql).toContain(`FROM v_valid), ${vectors.valid.length},`);
    expect(sql).toContain(`FROM v_invalid), ${vectors.invalid.length},`);
    expect(sql).toContain(`FROM v_norm), ${vectors.normalize.length},`);
  });
});
