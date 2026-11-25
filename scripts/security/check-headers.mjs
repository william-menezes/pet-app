// Confere que o vercel.json repete os cabeçalhos de segurança de src/security-headers.ts (fonte única).
// Spec 004, T105; contrato security-hardening §3. Sem dependências: o Node 24 carrega o .ts direto
// (o arquivo só usa sintaxe apagável e não importa nada).
//
// Reprova se:
//  1. o vercel.json não tem exatamente as regras esperadas (um `source` por caminho da tag e um para o
//     resto), com os valores iguais aos de `securityHeaders(kind, { https: true })`;
//  2. dois `source` se sobrepõem (a documentação da Vercel não diz como cabeçalhos repetidos de regras
//     sobrepostas se combinam: por isso as regras têm de ser mutuamente exclusivas);
//  3. a política quebra uma regra do contrato (unsafe-eval, unsafe-inline em script-src, host de
//     terceiro na política da tag, câmera fora do app, HSTS com preload).
// `--self-test`: prova que o script reprova quando só um dos dois lugares é editado.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const mod = await import(pathToFileURL(join(root, 'src', 'security-headers.ts')).href);
const { securityHeaders, TAG_SOURCES, APP_SOURCE, TURNSTILE_ORIGIN, headerKindForPath } = mod;

/** Caminhos de amostra para a prova de exclusividade. `kind` é o que a função do servidor decide. */
const SAMPLE_PATHS = [
  '/',
  '/auth/login',
  '/auth/recuperar-senha',
  '/auth',
  '/app',
  '/app/conta/celular',
  '/admin',
  '/legal/termos',
  '/legal/privacidade',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/chunk-ABCDEFGH.js',
  '/ativar',
  '/7K3MQ9XAC',
  '/7K3MQ9XAC/',
  '/7K3M-Q9XA-C',
  '/7k3m-q9xa-c/',
  '/7K3MQ9XAC/perdido',
  '/7K3M-Q9XA-C/perdido/',
  '/12345678',
  '/123456789',
  '/12345678901',
  '/123456789012',
  '/recuperar-senha',
  '/nao-existe',
];

/** `:code(RE)` da Vercel vira o grupo `(RE)`; o resto dos `source` usados aqui já é regex. */
function toRegExp(source) {
  return new RegExp(`^${source.replace(/:\w+\(/g, '(')}$`);
}

function expectedRules() {
  const tag = securityHeaders('tag', { https: true });
  const app = securityHeaders('app', { https: true });
  return [
    ...TAG_SOURCES.map((source) => ({ source, kind: 'tag', headers: tag })),
    { source: APP_SOURCE, kind: 'app', headers: app },
  ];
}

/** Lista de problemas (vazia = ok) de um conteúdo de vercel.json. */
export function analyze(config) {
  const problems = [];
  const rules = Array.isArray(config.headers) ? config.headers : [];
  const expected = expectedRules();

  // 1. mesmas regras, mesmos valores
  if (rules.length !== expected.length) {
    problems.push(`vercel.json tem ${rules.length} regras de cabeçalho; o esperado é ${expected.length}`);
  }
  for (const want of expected) {
    const rule = rules.find((r) => r.source === want.source);
    if (!rule) {
      problems.push(`falta no vercel.json a regra para o source ${want.source}`);
      continue;
    }
    const got = Object.fromEntries((rule.headers ?? []).map((h) => [h.key, h.value]));
    for (const [key, value] of Object.entries(want.headers)) {
      if (got[key] !== value) {
        problems.push(
          `${want.kind} (${want.source}): ${key} diverge.\n    vercel.json: ${got[key] ?? '(ausente)'}\n    security-headers.ts: ${value}`,
        );
      }
    }
    for (const key of Object.keys(got)) {
      if (!(key in want.headers)) problems.push(`${want.kind} (${want.source}): ${key} está só no vercel.json`);
    }
  }
  for (const rule of rules) {
    if (!expected.some((want) => want.source === rule.source)) {
      problems.push(`o vercel.json tem um source que não vem de security-headers.ts: ${rule.source}`);
    }
  }

  // 2. exclusividade: cada caminho de amostra casa com regras de UMA política só, e é a que o servidor usa
  for (const path of SAMPLE_PATHS) {
    const matching = rules.filter((r) => toRegExp(r.source).test(path));
    const kinds = new Set(matching.map((r) => expected.find((e) => e.source === r.source)?.kind ?? '?'));
    if (matching.length === 0) problems.push(`nenhuma regra cobre ${path}`);
    else if (kinds.size > 1 || (kinds.has('app') && matching.length > 1)) {
      problems.push(`${path} casa com regras de políticas diferentes (sobreposição): ${matching.map((r) => r.source).join(' | ')}`);
    } else if (!kinds.has(headerKindForPath(path))) {
      problems.push(`${path}: o vercel.json aplica ${[...kinds][0]}, o servidor aplica ${headerKindForPath(path)}`);
    }
  }

  // 3. regras do contrato, sobre os valores esperados
  for (const [kind, headers] of [
    ['tag', securityHeaders('tag', { https: true })],
    ['app', securityHeaders('app', { https: true })],
  ]) {
    const csp = headers['Content-Security-Policy'];
    const directive = (name) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
    if (csp.includes("'unsafe-eval'")) problems.push(`${kind}: CSP com 'unsafe-eval'`);
    if (directive('script-src').includes("'unsafe-inline'")) problems.push(`${kind}: script-src com 'unsafe-inline'`);
    if (!csp.includes('upgrade-insecure-requests')) problems.push(`${kind}: falta upgrade-insecure-requests (https)`);
    if (headers['Strict-Transport-Security']?.includes('preload')) problems.push(`${kind}: HSTS com preload`);
    if (kind === 'tag') {
      if (csp.includes(TURNSTILE_ORIGIN)) problems.push('tag: a CSP tem o host do desafio anti-robô');
      if (directive('frame-src')) problems.push('tag: a CSP tem frame-src');
      if (headers['Permissions-Policy'].includes('camera=(self)')) problems.push('tag: câmera liberada');
    } else {
      if (!directive('script-src').includes(TURNSTILE_ORIGIN)) problems.push('app: script-src sem o desafio anti-robô');
      if (directive('frame-src') !== `frame-src ${TURNSTILE_ORIGIN}`) problems.push('app: frame-src sem o desafio anti-robô');
      if (!headers['Permissions-Policy'].includes('camera=(self)')) problems.push('app: câmera não liberada');
    }
  }

  // O servidor não emite HTTPS-only em HTTP.
  for (const kind of ['tag', 'app']) {
    const http = securityHeaders(kind, { https: false });
    if ('Strict-Transport-Security' in http || http['Content-Security-Policy'].includes('upgrade-insecure-requests')) {
      problems.push(`${kind}: HSTS ou upgrade-insecure-requests emitidos em HTTP`);
    }
  }
  return problems;
}

function selfTest() {
  const base = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const clone = () => structuredClone(base);
  const cases = [];

  const onlyVercel = clone();
  onlyVercel.headers[onlyVercel.headers.length - 1].headers.find((h) => h.key === 'Referrer-Policy').value = 'no-referrer';
  cases.push(['edita só o vercel.json (Referrer-Policy do app)', onlyVercel]);

  const noCamera = clone();
  noCamera.headers[noCamera.headers.length - 1].headers.find((h) => h.key === 'Permissions-Policy').value =
    'geolocation=(self), camera=(), microphone=(), payment=(), usb=()';
  cases.push(['câmera negada no app do vercel.json', noCamera]);

  const overlap = clone();
  overlap.headers[0].source = '/(.*)';
  cases.push(['source da tag que sobrepõe o app', overlap]);

  const missing = clone();
  missing.headers.pop();
  cases.push(['regra do app removida', missing]);

  let failed = false;
  if (analyze(base).length > 0) {
    console.error('check:headers --self-test: o vercel.json atual já falha', analyze(base));
    failed = true;
  }
  for (const [name, config] of cases) {
    if (analyze(config).length === 0) {
      console.error(`check:headers --self-test: NÃO detectou: ${name}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log(`check:headers --self-test: ok (${cases.length} adulterações detectadas; o vercel.json atual passa)`);
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const problems = analyze(JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')));
  if (problems.length > 0) {
    console.error('check:headers: FALHOU');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('check:headers: ok (vercel.json e src/security-headers.ts dizem a mesma coisa)');
}
