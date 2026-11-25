#!/usr/bin/env node
/**
 * check:prod-config (spec 004, security-hardening.contract.md secao 7).
 * Reprova o ambiente de producao (`src/environments/environment.ts`) com:
 *  - `turnstileSiteKey` vazio;
 *  - URL do Supabase apontando para localhost/127.0.0.1;
 *  - qualquer identificador `*_STUB_*` (ex.: SMS_STUB_CODE).
 *
 * HOJE REPROVA, e isso e esperado: a chave real do Turnstile depende de uma conta Cloudflare que ainda nao existe.
 * Por isso NAO e passo obrigatorio do CI; entra quando a chave existir (registrado no execution-log da spec 004).
 *
 * Uso: node check-prod-config.mjs [--file caminho]
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkProdConfig(source) {
  const problems = [];
  const key = /turnstileSiteKey\s*:\s*(['"`])([^'"`]*)\1/.exec(source);
  if (!key) problems.push('turnstileSiteKey ausente');
  else if (key[2].trim() === '') problems.push('turnstileSiteKey vazio (desafio anti-robo desligado em producao)');
  const url = /supabaseUrl\s*:\s*(['"`])([^'"`]*)\1/.exec(source);
  if (!url) problems.push('supabaseUrl ausente');
  else if (/(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(url[2])) {
    problems.push('supabaseUrl aponta para localhost');
  } else if (!/^https:\/\//i.test(url[2])) problems.push('supabaseUrl nao usa https');
  if (/\w*_STUB_\w*/.test(source)) problems.push('identificador *_STUB_* no ambiente de producao');
  return problems;
}

export function run(argv) {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const idx = argv.indexOf('--file');
  const file = resolve(idx >= 0 ? argv[idx + 1] : join(here, '..', '..', 'src', 'environments', 'environment.ts'));
  const problems = checkProdConfig(readFileSync(file, 'utf8'));
  if (problems.length) {
    console.error('check:prod-config: REPROVADO');
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log('check:prod-config: ok');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
