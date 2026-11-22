/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { TAG_DOMAIN } from './tag-code';

/**
 * T010 (Principio VIII): o dominio impresso no QR e `TAGFARO.COM.BR` e nao muda nunca. Este teste varre o
 * codigo-fonte (nao os testes) e falha se achar outro dominio de tag, `vercel.app` incluido, ou se a
 * constante `TAG_DOMAIN` deixar de valer o dominio do contrato em qualquer das duas copias do modulo.
 */
const CONTRACT_DOMAIN = 'TAGFARO.COM.BR';

interface Source {
  path: string;
  text: string;
}

/** Ocorrencias que quebram o contrato: `vercel.app` em qualquer lugar, ou `tagfaro.<algo>` que nao seja `.com.br`. */
export function findForeignTagDomains(sources: Source[]): string[] {
  const found: string[] = [];
  for (const { path, text } of sources) {
    if (/vercel\.app/i.test(text)) found.push(`${path}: vercel.app`);
    for (const m of text.matchAll(/tagfaro\.([a-z0-9.-]+)/gi)) {
      if (!/^com\.br\.?$/i.test(m[1])) found.push(`${path}: ${m[0]}`);
    }
    for (const m of text.matchAll(/TAG_DOMAIN\s*=\s*['"`]([^'"`]*)['"`]/g)) {
      if (m[1] !== CONTRACT_DOMAIN) found.push(`${path}: TAG_DOMAIN = ${m[1]}`);
    }
  }
  return found;
}

function collect(dir: string, root: string, out: Source[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.angular') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, root, out);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$/.test(name)) {
      out.push({ path: relative(root, full).replace(/\\/g, '/'), text: readFileSync(full, 'utf8') });
    }
  }
}

describe('dominio da tag', () => {
  it('a constante vale o dominio do contrato', () => {
    expect(TAG_DOMAIN).toBe(CONTRACT_DOMAIN);
  });

  it('nenhum codigo-fonte de src/ ou supabase/functions/ usa outro dominio de tag', () => {
    const root = process.cwd();
    const sources: Source[] = [];
    collect(resolve(root, 'src'), root, sources);
    collect(resolve(root, 'supabase/functions'), root, sources);
    expect(sources.some((s) => s.path === 'src/app/core/tag-code/tag-code.ts')).toBe(true);
    expect(sources.some((s) => s.path === 'supabase/functions/_shared/tag-code.ts')).toBe(true);
    expect(findForeignTagDomains(sources)).toEqual([]);
  });

  it('o varredor acusa vercel.app, outro dominio e a constante trocada', () => {
    const base = "export const TAG_DOMAIN = 'TAGFARO.COM.BR';\nconst u = 'https://tagfaro.com.br/x';";
    expect(findForeignTagDomains([{ path: 'a.ts', text: base }])).toEqual([]);
    expect(findForeignTagDomains([{ path: 'b.ts', text: "const u = 'https://faro-pet.vercel.app/x';" }])).toHaveLength(1);
    expect(findForeignTagDomains([{ path: 'c.ts', text: "const u = 'https://tagfaro.com/x';" }])).toHaveLength(1);
    expect(findForeignTagDomains([{ path: 'd.ts', text: "const u = 'https://tagfaro.com.br.evil.io/x';" }])).toHaveLength(1);
    expect(findForeignTagDomains([{ path: 'e.ts', text: "export const TAG_DOMAIN = 'TAGFARO.COM';" }])).toContainEqual(
      'e.ts: TAG_DOMAIN = TAGFARO.COM',
    );
  });
});
