// Fronteira da página pública no pacote gerado (spec 002, T050; contrato shells.contract.md §10).
// Lê `dist/faro/stats.json` (mapa do esbuild, gerado por `npm run build:stats`) e confere:
//  1. o fecho estático da página pública não alcança o app autenticado, o tema escuro nem overlays;
//  2. nenhuma saída tem fonte da galeria de desenvolvimento;
//  3. nenhum .html de dist/faro/browser tem `onload=`;
//  4. nenhum .css de dist/faro/browser tem a cor-canário `0FA12E`.
// `core/auth` e `core/supabase` no fecho são só AVISO (exceção conhecida, vira tarefa da spec 003).
// `--self-test`: roda a mesma lógica sobre um mapa de exemplo com uma violação e exige que ela
// seja detectada. Sem dependências.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(root, 'dist', 'faro');
const BROWSER = join(DIST, 'browser');

const FORBIDDEN_IN_PUBLIC = [
  /src\/app\/features\/(auth|activation|pets|scans|account|admin|dev-gallery)\//,
  /src\/app\/shared\/shells\/(tutor-shell|admin-shell|flow-shell|screen-header|shell-fallback)\//,
  /src\/app\/core\/theme\//,
  /src\/app\/shared\/components\/(alert-dialog|sonner)\//,
  /node_modules\/ngx-sonner\//,
  /src\/app\/shared\/components\/faro\/turnstile\//,
];
const KNOWN_EXCEPTION = [/src\/app\/core\/auth\//, /src\/app\/core\/supabase\//];
const GALLERY = /src\/app\/features\/dev-gallery\//;

const norm = (p) => p.replace(/\\/g, '/');
const isJs = (name) => name.endsWith('.js');

/** Saídas `.js` alcançáveis por import estático a partir de `seeds`. */
function closure(outputs, seeds) {
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name) || !outputs[name]) continue;
    seen.add(name);
    for (const imp of outputs[name].imports ?? []) {
      if (imp.kind === 'import-statement' && isJs(imp.path)) queue.push(imp.path);
    }
  }
  return seen;
}

function sourcesOf(outputs, names) {
  const sources = new Map(); // fonte -> saída
  for (const name of names) {
    for (const input of Object.keys(outputs[name]?.inputs ?? {})) sources.set(norm(input), name);
  }
  return sources;
}

/** Parte pura: devolve `{ violations, warnings, publicSet }` para um `stats.json` já lido. */
export function analyze(stats) {
  const violations = [];
  const warnings = [];
  const outputs = Object.fromEntries(Object.entries(stats.outputs ?? {}).filter(([name]) => isJs(name)));

  const seeds = Object.entries(outputs)
    .filter(
      ([name, out]) =>
        name.startsWith('main-') ||
        name.startsWith('polyfills-') ||
        norm(out.entryPoint ?? '').startsWith('src/app/features/public/'),
    )
    .map(([name]) => name);

  const publicSet = closure(outputs, seeds);
  const sources = sourcesOf(outputs, publicSet);

  for (const [source, output] of sources) {
    if (FORBIDDEN_IN_PUBLIC.some((re) => re.test(source))) {
      violations.push(`fecho da página pública alcança ${source} (saída ${output})`);
    } else if (KNOWN_EXCEPTION.some((re) => re.test(source))) {
      warnings.push(`${source} (saída ${output})`);
    }
  }

  // Galeria fora de produção: em qualquer saída `.js` (do navegador ou do servidor, `.mjs` incluso).
  for (const [name, out] of Object.entries(stats.outputs ?? {})) {
    for (const input of Object.keys(out.inputs ?? {})) {
      if (GALLERY.test(norm(input))) violations.push(`a saída ${name} tem fonte da galeria: ${norm(input)}`);
    }
  }

  return { violations, warnings, publicSet, outputs };
}

function selfTest() {
  const sample = {
    outputs: {
      'main-AAA.js': {
        entryPoint: 'src/main.ts',
        imports: [
          { path: 'chunk-BBB.js', kind: 'import-statement' },
          { path: 'chunk-LAZY.js', kind: 'dynamic-import' },
        ],
        inputs: { 'src/main.ts': {} },
      },
      'chunk-BBB.js': {
        imports: [],
        inputs: { 'src/app/features/pets/pets/pets.ts': {}, 'src/app/core/auth/auth.guard.ts': {} },
      },
      // Só por import dinâmico: não pode contar como violação.
      'chunk-LAZY.js': { imports: [], inputs: { 'src/app/features/admin/admin/admin.ts': {} } },
    },
  };
  const { violations, warnings } = analyze(sample);
  const caught = violations.length === 1 && violations[0].includes('features/pets/');
  const lazyIgnored = !violations.some((v) => v.includes('features/admin/'));
  const warned = warnings.some((w) => w.includes('core/auth/'));
  if (caught && lazyIgnored && warned) {
    console.log('check:bundle --self-test: ok (violação detectada, import dinâmico ignorado, exceção só avisada)');
    process.exit(0);
  }
  console.error('check:bundle --self-test: FALHOU', { violations, warnings });
  process.exit(1);
}

function walk(dir, ext, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, ext, found);
    else if (entry.endsWith(ext)) found.push(full);
  }
  return found;
}

function sizes(names) {
  let raw = 0;
  let gz = 0;
  for (const name of names) {
    const file = join(BROWSER, name);
    if (!existsSync(file)) continue;
    const buffer = readFileSync(file);
    raw += buffer.length;
    gz += gzipSync(buffer).length;
  }
  return { raw, gz };
}
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

function main() {
  const statsFile = join(DIST, 'stats.json');
  if (!existsSync(statsFile)) {
    console.error('check:bundle: dist/faro/stats.json não existe. Rode `npm run build:stats` antes.');
    process.exit(1);
  }
  const stats = JSON.parse(readFileSync(statsFile, 'utf8'));
  if (!stats.outputs || !Object.values(stats.outputs).some((o) => o.entryPoint)) {
    console.error('check:bundle: stats.json sem `outputs` ou sem `entryPoint`. PARE e reporte (T050).');
    process.exit(1);
  }

  const { violations, warnings, publicSet, outputs } = analyze(stats);

  // 5A. Nenhum host do desafio anti-robô (Turnstile) no pacote inicial nem no fecho da página pública:
  // o script só pode ser pedido, em tempo de execução, pelas telas de /auth e /app/conta.
  for (const name of publicSet) {
    const file = join(BROWSER, name);
    if (existsSync(file) && /challenges\.cloudflare\.com/.test(readFileSync(file, 'utf8'))) {
      violations.push(`${name} (pacote inicial ou público) contém challenges.cloudflare.com`);
    }
  }
  for (const file of walk(BROWSER, '.html')) {
    if (/challenges\.cloudflare\.com/.test(readFileSync(file, 'utf8'))) {
      violations.push(`${norm(file.slice(BROWSER.length + 1))} contém challenges.cloudflare.com`);
    }
  }

  // 6. onload= nos .html (index.csr.html e pré-renderizados)
  for (const file of walk(BROWSER, '.html')) {
    if (/\sonload=/.test(readFileSync(file, 'utf8'))) {
      violations.push(`${norm(file.slice(BROWSER.length + 1))} tem o atributo onload=`);
    }
  }
  // 7. cor-canário nos .css
  for (const file of walk(BROWSER, '.css')) {
    if (/0FA12E/i.test(readFileSync(file, 'utf8'))) {
      violations.push(`${norm(file.slice(BROWSER.length + 1))} contém 0FA12E (varredura do Tailwind sem limite)`);
    }
  }

  // Números (informativos): pacote inicial e rotas públicas.
  const initial = closure(outputs, Object.keys(outputs).filter((n) => n.startsWith('main-') || n.startsWith('polyfills-')));
  const routeSets = Object.entries(outputs)
    .filter(([, out]) => norm(out.entryPoint ?? '').startsWith('src/app/features/public/'))
    .map(([name, out]) => [norm(out.entryPoint), closure(outputs, [name, ...initial])]);
  const line = (label, names) => {
    const s = sizes(names);
    return `  ${label}: ${names.size} arquivos, ${kb(s.raw)} (gzip ${kb(s.gz)})`;
  };
  console.log('check:bundle: tamanhos do JavaScript (fecho estático, informativo)');
  console.log(line('pacote inicial (main + polyfills)', initial));
  for (const [entry, set] of routeSets) console.log(line(`rota ${entry.replace('src/app/features/public/', '')}`, set));
  console.log(`  fecho público total (inicial + rotas públicas): ${publicSet.size} arquivos`);

  if (warnings.length > 0) {
    console.warn('check:bundle: AVISO (exceção conhecida, vira tarefa da spec 003): core/auth e core/supabase no pacote público:');
    for (const w of [...new Set(warnings)]) console.warn(`  - ${w}`);
  }

  if (violations.length > 0) {
    console.error('check:bundle: FALHOU');
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('check:bundle: ok');
}

if (process.argv.includes('--self-test')) selfTest();
else main();
