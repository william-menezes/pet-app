#!/usr/bin/env node
/**
 * check:secrets (spec 004, security-hardening.contract.md secao 7).
 * Varre os arquivos rastreados pelo git e, se existir, `dist/`. Reprova:
 *  - JWT cujo conteudo declara "role":"service_role";
 *  - chaves `sb_secret_...`;
 *  - atribuicao com valor a FARO_SSR_KEY, IP_HASH_SECRET, PHONE_OTP_PEPPER, HASH_SALT, SUPABASE_AUTH_CAPTCHA_SECRET;
 *  - arquivo `lote*.csv` ou `pins.csv`; CSV com a coluna `activation_pin`.
 * Nunca imprime o valor achado: so arquivo, linha e a regra.
 *
 * Uso: node check-secrets.mjs [--staged] [--root DIR --no-git]
 *   --staged : so os arquivos preparados (gancho de pre-commit), lendo o conteudo preparado.
 *   --root   : raiz a varrer (padrao: raiz do repositorio). Com --no-git percorre o disco em vez do git (testes).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECRET_NAMES = [
  'FARO_SSR_KEY',
  'IP_HASH_SECRET',
  'PHONE_OTP_PEPPER',
  'HASH_SALT',
  'SUPABASE_AUTH_CAPTCHA_SECRET',
];

/**
 * Valores de TESTE ja versionados, aceitos por (arquivo, valor exato). Nunca por pasta: um valor novo no
 * mesmo arquivo continua reprovando. Todos sao descartaveis (stack local do CI).
 */
export const ALLOWED_ASSIGNMENTS = [
  { file: 'scripts/ci/supabase-checks.sh', value: 'ci-test-salt-0123456789' },
  { file: 'scripts/ci/e2e-prepare.sh', value: 'ci-test-salt-0123456789' },
  { file: 'scripts/ci/e2e-prepare.sh', value: 'ci-test-pepper-0123456789-0123456789-abcdef' },
  { file: 'specs/004-conta-tutor/quickstart.md', value: 'local-dev-salt-0123456789' },
  { file: 'specs/004-conta-tutor/quickstart.md', value: 'local-dev-pepper-0123456789-abcdefghij' },
  { file: 'specs/004-conta-tutor/quickstart.md', value: 'curto' },
  { file: 'supabase/.env.local.example', value: 'local-dev-salt-replace-in-production' },
  { file: 'supabase/.env.local.example', value: 'local-dev-pepper-0123456789-abcdefghij' },
  ...['local-dev-salt-0123456789', 'local-dev-pepper-0123456789-abcdefghij', 'curto-demais', '0123456789abcdef', 'curto', 'segredo-curto'].map(
    (value) => ({ file: 'supabase/functions/_shared/env.test.ts', value }),
  ),
];

// '=' vale sempre; ':' so com valor entre aspas (evita texto corrido como 'sem PHONE_OTP_PEPPER: a funcao...').
const ASSIGN = new RegExp(
  String.raw`\b(${SECRET_NAMES.join('|')})[ \t]*(?:=[ \t]*["']?|:[ \t]*["'])([^\s"'\x60#;,)]*)`,
  'g',
);
const JWT = /eyJ[A-Za-z0-9_-]{6,}\.([A-Za-z0-9_-]{6,})\.[A-Za-z0-9_-]*/g;
const SB_SECRET = /\bsb_secret_[A-Za-z0-9_-]{8,}/;
const TEXT_EXT = new Set(['', '.js', '.mjs', '.cjs', '.ts', '.json', '.html', '.css', '.txt', '.md', '.sh', '.yml', '.yaml', '.toml', '.sql', '.csv', '.map', '.example', '.xlf', '.env', '.webmanifest', '.svg']);

function isPlaceholder(value) {
  return (
    value === '' ||
    value.startsWith('env(') ||
    value.startsWith('$') ||
    value.startsWith('<') ||
    value.startsWith('{') ||
    /^(\.\.\.|x+$|changeme|seu|sua|valor|your)/i.test(value) ||
    value.includes('${') ||
    value.includes('$(')
  );
}

/** @returns {{ file: string, line: number, rule: string }[]} */
export function scanText(file, content) {
  const findings = [];
  const norm = file.split(sep).join('/');
  const name = basename(norm);
  if (/^lote.*\.csv$/i.test(name) || /^pins\.csv$/i.test(name)) {
    findings.push({ file: norm, line: 0, rule: 'arquivo de lote ou de PINs (lote*.csv, pins.csv) nao pode ir ao git' });
  }
  if (name.toLowerCase().endsWith('.csv')) {
    const header = content.split(/\r?\n/, 1)[0] ?? '';
    if (/activation_pin/i.test(header)) {
      findings.push({ file: norm, line: 1, rule: 'CSV com a coluna activation_pin' });
    }
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((text, i) => {
    for (const m of text.matchAll(JWT)) {
      try {
        const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
        if (payload && payload.role === 'service_role') {
          findings.push({ file: norm, line: i + 1, rule: 'JWT com role service_role' });
        }
      } catch {
        /* nao e um JWT de verdade */
      }
    }
    if (SB_SECRET.test(text)) findings.push({ file: norm, line: i + 1, rule: 'chave sb_secret_' });
    for (const m of text.matchAll(ASSIGN)) {
      const value = m[2];
      if (isPlaceholder(value)) continue;
      if (ALLOWED_ASSIGNMENTS.some((a) => a.file === norm && a.value === value)) continue;
      findings.push({ file: norm, line: i + 1, rule: `atribuicao com valor a ${m[1]}` });
    }
  });
  return findings;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function run(argv) {
  const staged = argv.includes('--staged');
  const noGit = argv.includes('--no-git');
  const rootIdx = argv.indexOf('--root');
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(rootIdx >= 0 ? argv[rootIdx + 1] : join(here, '..', '..'));
  const findings = [];
  let count = 0;

  /** @type {{ rel: string, read: () => string }[]} */
  const targets = [];
  if (noGit) {
    for (const p of walk(root)) targets.push({ rel: relative(root, p), read: () => readFileSync(p, 'utf8') });
  } else if (staged) {
    const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    for (const n of names) {
      targets.push({ rel: n, read: () => execFileSync('git', ['show', `:${n}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) });
    }
  } else {
    const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
    for (const n of names) {
      if (existsSync(join(root, n))) targets.push({ rel: n, read: () => readFileSync(join(root, n), 'utf8') });
    }
    const dist = join(root, 'dist');
    if (existsSync(dist)) for (const p of walk(dist)) targets.push({ rel: relative(root, p), read: () => readFileSync(p, 'utf8') });
  }

  for (const t of targets) {
    findings.push(...scanText(t.rel, '').filter((f) => f.line === 0));
    if (!TEXT_EXT.has(extname(t.rel).toLowerCase())) continue;
    try {
      const abs = join(root, t.rel);
      if (!staged && existsSync(abs) && statSync(abs).size > 20 * 1024 * 1024) continue;
      const content = t.read();
      count++;
      findings.push(...scanText(t.rel, content).filter((f) => f.line !== 0));
    } catch {
      /* arquivo ilegivel: ignora */
    }
  }

  if (findings.length) {
    console.error('check:secrets: REPROVADO');
    for (const f of findings) console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.rule}`);
    return 1;
  }
  console.log(`check:secrets: ok (${count} arquivos varridos${staged ? ', so os preparados' : ''})`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
