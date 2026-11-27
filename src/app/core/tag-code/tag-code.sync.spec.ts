/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * T009: o modulo do codigo da tag vive em dois lugares (app e Edge Functions) e os dois arquivos tem de
 * ser identicos byte a byte (research.md secao 1). Se este teste falhar, copie
 * `src/app/core/tag-code/tag-code.ts` para `supabase/functions/_shared/tag-code.ts` (ou o contrario,
 * se a mudanca nasceu la) e rode de novo. Nunca "ajuste" so um dos dois.
 */
const APP_FILE = 'src/app/core/tag-code/tag-code.ts';
const EDGE_FILE = 'supabase/functions/_shared/tag-code.ts';

/** Primeira diferenca entre dois textos: indice do byte, ou -1 se iguais. */
export function firstDifference(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

describe('tag-code: sincronia entre o app e as Edge Functions', () => {
  const root = process.cwd();
  const app = readFileSync(resolve(root, APP_FILE));
  const edge = readFileSync(resolve(root, EDGE_FILE));

  it('os dois arquivos sao identicos byte a byte', () => {
    const at = firstDifference(app, edge);
    expect(at, `diferem a partir do byte ${at}: copie um arquivo sobre o outro`).toBe(-1);
    expect(app.equals(edge)).toBe(true);
  });

  it('o comparador acusa a troca de um unico caractere em qualquer dos dois lados', () => {
    const changed = Buffer.from(app);
    const pos = app.indexOf(Buffer.from('TAGFARO.COM.BR'));
    expect(pos).toBeGreaterThan(0);
    changed[pos] = changed[pos] === 0x58 ? 0x59 : 0x58; // T -> X
    expect(firstDifference(changed, edge)).toBe(pos);
    expect(firstDifference(app, changed)).toBe(pos);
    expect(changed.equals(edge)).toBe(false);
    expect(firstDifference(app, app.subarray(0, app.length - 1))).toBe(app.length - 1);
  });
});
