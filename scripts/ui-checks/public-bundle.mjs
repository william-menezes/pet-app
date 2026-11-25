// Fronteira da página pública no pacote gerado (spec 002, T050; contrato shells.contract.md §10).
// Lê `dist/faro/stats.json` (mapa do esbuild, gerado por `npm run build:stats`) e confere:
//  1. o fecho estático da página pública não alcança o app autenticado, o tema escuro nem overlays;
//  2. nenhuma saída tem fonte da galeria de desenvolvimento;
//  3. nenhum .html de dist/faro/browser tem `onload=`;
//  4. nenhum .css de dist/faro/browser tem a cor-canário `0FA12E`.
// 3. `core/auth`, `core/account`, `core/supabase` e `@supabase/supabase-js` no fecho ESTÁTICO do pacote público
//    REPROVAM (spec 003, T034B): os guards entram por `lazyCanMatch` e a sessão por `import()` dinâmico.
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
  /src\/app\/core\/(auth|account|supabase)\//,
  /node_modules\/@supabase\//,
  // 003: ativação, pets e scans são do app autenticado; o Leaflet só baixa na tela de scans.
  /src\/app\/core\/(pets|scans)\//,
  /src\/app\/core\/tags\/(tag\.service|activation)/,
  /node_modules\/leaflet\//,
];
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

/** Parte pura: devolve `{ violations, publicSet, outputs }` para um `stats.json` já lido. */
export function analyze(stats) {
  const violations = [];
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
    }
  }

  // Galeria fora de produção: em qualquer saída `.js` (do navegador ou do servidor, `.mjs` incluso).
  for (const [name, out] of Object.entries(stats.outputs ?? {})) {
    for (const input of Object.keys(out.inputs ?? {})) {
      if (GALLERY.test(norm(input))) violations.push(`a saída ${name} tem fonte da galeria: ${norm(input)}`);
    }
  }

  return { violations, publicSet, outputs };
}

/** Meta de JavaScript baixado pela rota da tag (gzip), em kB (contrato `rls-expectations`: JS <= 100 KB). */
const TAG_ROUTE_BUDGET_KB = 100;

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
  const { violations } = analyze(sample);
  const caughtPets = violations.some((v) => v.includes('features/pets/'));
  const caughtAuth = violations.some((v) => v.includes('core/auth/'));
  const lazyIgnored = !violations.some((v) => v.includes('features/admin/'));
  const supabase = analyze({
    outputs: {
      'main-AAA.js': {
        entryPoint: 'src/main.ts',
        imports: [{ path: 'chunk-S.js', kind: 'import-statement' }],
        inputs: { 'src/main.ts': {} },
      },
      'chunk-S.js': { imports: [], inputs: { 'node_modules/@supabase/supabase-js/dist/index.mjs': {} } },
    },
  }).violations.some((v) => v.includes('@supabase/'));
  if (caughtPets && caughtAuth && lazyIgnored && supabase) {
    console.log('check:bundle --self-test: ok (app autenticado, core/auth e supabase-js reprovam; import dinâmico ignorado)');
    process.exit(0);
  }
  console.error('check:bundle --self-test: FALHOU', { violations });
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

  const { violations, publicSet, outputs } = analyze(stats);

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
  const tagRoute = routeSets.find(([entry]) => entry.endsWith('/tag-page/tag-page.ts'));
  if (tagRoute) {
    const { gz } = sizes(tagRoute[1]);
    const verdict = gz / 1024 <= TAG_ROUTE_BUDGET_KB ? 'dentro da meta' : 'ACIMA da meta';
    console.log(`  rota da tag: ${kb(gz)} em gzip, meta de ${TAG_ROUTE_BUDGET_KB} kB: ${verdict}`);
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
