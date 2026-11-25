#!/usr/bin/env node
/**
 * check:templates (spec 004, security-hardening.contract.md secao 7).
 * Reprova `[innerHTML]`, `[outerHTML]` e `bypassSecurityTrust*` em `src/app/`.
 *
 * Excecoes: lista fechada por (arquivo, trecho exato da linha) e com justificativa. Qualquer outro uso reprova.
 * Arquivos `*.spec.ts` ficam de fora: so leem o DOM em asserts e nao entram no pacote.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  { re: /\[\s*innerHTML\s*\]/, rule: '[innerHTML]' },
  { re: /\[\s*outerHTML\s*\]/, rule: '[outerHTML]' },
  { re: /bypassSecurityTrust\w*/, rule: 'bypassSecurityTrust*' },
];

/**
 * Excecoes registradas (specs/004-conta-tutor/execution-log.md, QA):
 * o `z-alert-dialog` do ZardUI usa `[innerHTML]` com `config.zDescription`. O Angular sanitiza o valor, e hoje todo
 * `zDescription` do Faro e texto fixo ou mensagem de erro do proprio app, nunca dado do usuario. Se alguma tela passar
 * dado do usuario para `zDescription`, trocar por interpolacao.
 */
export const ALLOWED = [
  {
    file: 'src/app/shared/components/alert-dialog/alert-dialog-container.component.ts',
    contains: '<span [innerHTML]="config.zDescription"></span>',
  },
];

export function scanText(file, content) {
  const norm = file.split(sep).join('/');
  const out = [];
  content.split(/\r?\n/).forEach((text, i) => {
    if (/^\s*(<!--|\/\/|\*|\/\*)/.test(text)) return; // linha de comentario
    for (const { re, rule } of RULES) {
      if (!re.test(text)) continue;
      if (ALLOWED.some((a) => a.file === norm && text.includes(a.contains))) continue;
      out.push({ file: norm, line: i + 1, rule });
    }
  });
  return out;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

export function run(argv) {
  const rootIdx = argv.indexOf('--root');
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : join(here, '..', '..'));
  const base = join(root, 'src', 'app');
  const findings = [];
  const files = walk(base);
  for (const p of files) findings.push(...scanText(relative(root, p), readFileSync(p, 'utf8')));
  if (findings.length) {
    console.error('check:templates: REPROVADO');
    for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}`);
    return 1;
  }
  console.log(`check:templates: ok (${files.length} arquivos de src/app; ${ALLOWED.length} excecao registrada)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
