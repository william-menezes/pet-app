// Testes dos scripts de seguranca do repositorio (spec 004, T106). Rodam com `npm run test:scripts` (node --test).
// Cada script passa no estado atual e reprova o exemplo ruim que o proprio teste cria e apaga.
// Segredos falsos sao montados em tempo de execucao: nenhum literal que o check:secrets acusaria vai para o git.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { scanText as scanSecrets } from './check-secrets.mjs';
import { scanText as scanTemplates } from './check-templates.mjs';
import { checkProdConfig } from './check-prod-config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const node = (script, args = []) => spawnSync(process.execPath, [join(here, script), ...args], { cwd: repo, encoding: 'utf8' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.${'a'.repeat(20)}`;

test('check:secrets passa no estado atual do repositorio', () => {
  const r = node('check-secrets.mjs');
  assert.equal(r.status, 0, r.stderr);
});

test('check:secrets nao acusa o segredo por referencia nem as chaves publicas de teste do Turnstile', () => {
  const toml = 'secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"\n# segredo de teste 1x0000000000000000000000000000000AA e site key 1x00000000000000000000AA\n';
  assert.deepEqual(scanSecrets('supabase/config.toml', toml), []);
  assert.deepEqual(scanSecrets('x.sh', 'HASH_' + 'SALT=$HASH_SALT\nPHONE_OTP_PEPPER="${PEPPER}"\n'), []);
});

test('check:secrets reprova JWT service_role e aceita JWT anon', () => {
  assert.equal(scanSecrets('a.ts', `const k = '${jwt({ role: 'service_role' })}';`).length, 1);
  assert.deepEqual(scanSecrets('a.ts', `const k = '${jwt({ role: 'anon' })}';`), []);
});

test('check:secrets reprova sb_secret_ e atribuicao com valor', () => {
  assert.equal(scanSecrets('a.ts', `k = 'sb_secret_${'x1'.repeat(12)}'`).length, 1);
  assert.equal(scanSecrets('a.sh', ['IP_HASH', 'SECRET'].join('_') + '=k9f3-real-0042-zzz').length, 1);
  assert.equal(scanSecrets('a.ts', 'const e = { ' + ['FARO_SSR', 'KEY'].join('_') + ": 'abc123def456' };").length, 1);
  assert.equal(scanSecrets('a.env', ['SUPABASE_AUTH_CAPTCHA', 'SECRET'].join('_') + '=0x4AAAAAAAxyz').length, 1);
});

test('a lista de excecoes e por valor exato: valor novo no mesmo arquivo reprova', () => {
  assert.deepEqual(scanSecrets('scripts/ci/supabase-checks.sh', 'HASH_' + 'SALT=ci-test-salt-0123456789'), []);
  assert.equal(scanSecrets('scripts/ci/supabase-checks.sh', 'HASH_' + 'SALT=outro-valor-qualquer-1').length, 1);
});

test('check:secrets reprova pins.csv, lote*.csv e CSV com activation_pin (arquivos criados e apagados pelo teste)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'faro-secrets-'));
  try {
    mkdirSync(join(dir, 'tools'));
    writeFileSync(join(dir, 'tools', 'pins.csv'), 'a,b\n1,2\n');
    writeFileSync(join(dir, 'lote-009.csv'), 'a\n1\n');
    writeFileSync(join(dir, 'outro.csv'), 'code,activation_pin\nX,Y\n');
    writeFileSync(join(dir, 'falso.ts'), `const k = '${jwt({ role: 'service_role' })}';\n`);
    const r = node('check-secrets.mjs', ['--root', dir, '--no-git']);
    assert.equal(r.status, 1);
    for (const alvo of ['pins.csv', 'lote-009.csv', 'outro.csv', 'falso.ts']) assert.match(r.stderr, new RegExp(alvo.replace('.', '\\.')));
    assert.doesNotMatch(r.stderr, /service_role['"]/); // nunca imprime o valor
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check:templates passa hoje e reprova innerHTML, outerHTML e bypassSecurityTrust fora da excecao', () => {
  assert.equal(node('check-templates.mjs').status, 0);
  assert.equal(scanTemplates('src/app/x/x.html', '<div [innerHTML]="v"></div>').length, 1);
  assert.equal(scanTemplates('src/app/x/x.html', '<div [outerHTML]="v"></div>').length, 1);
  assert.equal(scanTemplates('src/app/x/x.ts', 'this.s.bypassSecurityTrustHtml(v)').length, 1);
  assert.equal(
    scanTemplates('src/app/outro/outro.ts', '<span [innerHTML]="config.zDescription"></span>').length,
    1,
    'a excecao vale so para o arquivo registrado',
  );
});

test('check:prod-config reprova chave vazia, localhost e *_STUB_*; passa com o ambiente completo', () => {
  const ok = "export const environment = { supabaseUrl: 'https://abc.supabase.co', turnstileSiteKey: '0x4AAAAAAAAAAAA' };";
  assert.deepEqual(checkProdConfig(ok), []);
  assert.equal(checkProdConfig(ok.replace("'0x4AAAAAAAAAAAA'", "''")).length, 1);
  assert.equal(checkProdConfig(ok.replace('https://abc.supabase.co', 'http://127.0.0.1:54321')).length >= 1, true);
  assert.equal(checkProdConfig(ok.replace('https://abc.supabase.co', 'https://localhost:54321')).length >= 1, true);
  assert.equal(checkProdConfig(`${ok}\nconst SMS_STUB_CODE = '1';`).length, 1);
});

test('check:prod-config reprova HOJE o ambiente de producao real (turnstileSiteKey vazio), como esperado', () => {
  const r = node('check-prod-config.mjs');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /turnstileSiteKey vazio/);
});
