// Checagem "não sobrou a pilha antiga" (spec 002, T038, T056, T062).
// Falha (código 1, com arquivo e linha) se PrimeNG, Lucide, o tema antigo, cores soltas ou
// variáveis de tema fora de src/styles.css reaparecerem. Sem dependências.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

// ── 1. dependências ──
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
for (const name of Object.keys(deps)) {
  if (/^(primeng|primeicons|@primeuix\/.+|@primeng\/.+|@ng-icons\/lucide)$/.test(name)) {
    fail('package.json', `dependência proibida: ${name}`);
  }
}

// ── 3. angular.json → styles ──
const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
const styles = angular.projects?.faro?.architect?.build?.options?.styles;
if (JSON.stringify(styles) !== JSON.stringify(['src/styles.css'])) {
  fail('angular.json', `styles deve ser ["src/styles.css"], achei ${JSON.stringify(styles)}`);
}

// ── 4. pastas que não podem existir ──
for (const dir of [
  'src/styles',
  'src/theme',
  'src/app/features/health-records',
  'src/app/features/reminders',
  'src/app/features/subscription',
]) {
  if (existsSync(join(root, dir))) fail(dir, 'pasta que não pode existir');
}

// ── 10, 11, 12, 14, 15: service worker (T062) ──
if (/@angular\/service-worker/.test(readFileSync(join(root, 'package.json'), 'utf8'))) {
  fail('package.json', 'contém @angular/service-worker');
}
if (existsSync(join(root, 'ngsw-config.json'))) fail('ngsw-config.json', 'arquivo que não pode existir');
if (/serviceWorker/.test(readFileSync(join(root, 'angular.json'), 'utf8'))) fail('angular.json', 'contém serviceWorker');
// Exceção exigida: o arquivo de desligamento fica em public/ por pelo menos 12 meses (research §R12).
const killSwitch = join(root, 'public/ngsw-worker.js');
if (!existsSync(killSwitch)) fail('public/ngsw-worker.js', 'o arquivo de desligamento precisa existir');
else if (!readFileSync(killSwitch, 'utf8').includes('registration.unregister')) {
  fail('public/ngsw-worker.js', 'não contém registration.unregister');
}
const manifestPath = join(root, 'public/manifest.webmanifest');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const icon of manifest.icons ?? []) {
    if (!existsSync(join(root, 'public', icon.src))) fail('public/manifest.webmanifest', `ícone que não existe em public/: ${icon.src}`);
  }
}

// ── varredura de src/ ──
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|html|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const RULE2 = /primeng|@primeuix|primeicons|providePrimeNG|FaroPreset|\bpi pi-|<p-[a-z]|\bpButton\b|\bpInputText\b/;
const RULE5 =
  /Poppins|JetBrains|#3A4FD6|#7FBF3F|faro-dark|--surface-0|--text-strong|var\(--app\b|var\(--r-(sm|md|lg)\)|var\(--indigo-|fonts\.googleapis|fonts\.gstatic/i;
const RULE6 =
  /--(background|foreground|card|primary|secondary|muted|accent|destructive|border|input|ring|brand|ink|lost|text|link)\s*:/;
const RULE7 = /#[0-9a-fA-F]{6}\b|\b(rgb|rgba|hsl|hsla|oklch)\(/;
// 8: só a casca do tutor aplica a classe dark. 9: nunca em html nem em body.
const RULE8 = /class\.dark|classList\.add\('dark'\)|classList\.toggle\('dark'|class="dark/;
const RULE9 = /(documentElement|body)\.classList.*dark|dark.*(documentElement|body)\.classList/;
// 13: nada de service worker em src/.
const RULE13 = /provideServiceWorker|@angular\/service-worker|serviceWorker\.register/;

for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file).split(sep).join('/');
  const isThemeFile = rel === 'src/styles.css';
  const isSpec = rel.endsWith('.spec.ts');
  const isGlyph = rel === 'src/app/shared/components/faro/google-glyph/google-glyph.ts';
  const inApp = rel.startsWith('src/app/');
  const mayApplyDark = rel.startsWith('src/app/shared/shells/tutor-shell/') || rel.startsWith('src/app/features/dev-gallery/');
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      if (RULE2.test(line)) fail(at, `PrimeNG: ${line.trim()}`);
      if (RULE5.test(line)) fail(at, `identidade antiga: ${line.trim()}`);
      if (!isThemeFile && RULE6.test(line)) fail(at, `variável de tema fora de src/styles.css: ${line.trim()}`);
      if (inApp && !isSpec && !isGlyph && RULE7.test(line)) fail(at, `cor solta: ${line.trim()}`);
      if (inApp && !isSpec && !mayApplyDark && RULE8.test(line)) fail(at, `classe dark fora da casca do tutor: ${line.trim()}`);
      if (RULE9.test(line)) fail(at, `classe dark em html ou body: ${line.trim()}`);
      if (RULE13.test(line)) fail(at, `service worker: ${line.trim()}`);
    });
}

if (problems.length) {
  console.error(`check:stack falhou (${problems.length}):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('check:stack ok: nenhuma sobra da pilha antiga.');
