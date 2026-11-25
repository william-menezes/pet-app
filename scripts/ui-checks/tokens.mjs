// Checagem dos tokens de design (spec 002, T008).
// Lê src/styles.css, confere cada variável das tabelas 2.1 e 2.2 do contrato
// (specs/002-ui-zardui/contracts/design-tokens.contract.md) e calcula o contraste WCAG 2.1
// dos pares da seção 5, nos dois temas. Sem dependências.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(root, 'src', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Extrai as declarações `--nome: valor;` do bloco que começa em `seletor {`. */
function block(selector) {
  const start = css.search(new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{`));
  if (start < 0) throw new Error(`bloco ${selector} não encontrado em src/styles.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const vars = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

// Valores esperados: tabelas 2.1 e 2.2 do contrato (claro e escuro).
const LIGHT = {
  '--radius': '0.75rem',
  '--background': '#F7F8F8', '--foreground': '#13201E', '--card': '#FFFFFF', '--card-foreground': '#13201E',
  '--popover': '#FFFFFF', '--popover-foreground': '#13201E',
  '--primary': '#84C32E', '--primary-foreground': '#13201E', '--primary-hover': '#76B027', '--primary-press': '#689B22',
  '--secondary': '#EEF0F8', '--secondary-foreground': '#25337A',
  '--muted': '#EEF0F1', '--muted-foreground': '#5E6C69',
  '--accent': '#EEF0F8', '--accent-foreground': '#25337A',
  '--destructive': '#C23A2B', '--destructive-foreground': '#FFFFFF', '--destructive-hover': '#A52E22',
  '--border': '#E2E5E7', '--input': '#7F8B88', '--ring': '#13201E', '--ring-gap': '#FFFFFF',
  '--chart-1': '#25337A', '--chart-2': '#557F29', '--chart-3': '#C26A12', '--chart-4': '#1F6FB2', '--chart-5': '#8E9ACF',
  '--sidebar': '#FFFFFF', '--sidebar-foreground': '#13201E', '--sidebar-primary': '#13201E',
  '--sidebar-primary-foreground': '#FFFFFF', '--sidebar-accent': '#EEF0F8', '--sidebar-accent-foreground': '#25337A',
  '--sidebar-border': '#E2E5E7', '--sidebar-ring': '#13201E',
  '--text': '#33403D', '--inset': '#F7F8F8', '--divider': '#EEF0F1', '--link': '#25337A',
  '--ink': '#13201E', '--ink-foreground': '#FFFFFF',
  '--brand': '#25337A', '--brand-foreground': '#FFFFFF', '--brand-muted': '#DADFF0', '--brand-deep': '#32418C',
  '--success-soft': '#E4F4EA', '--success-foreground': '#0F5E30',
  '--warning-soft': '#FBF1DD', '--warning-foreground': '#8A4A0C',
  '--danger-soft': '#FBE7E4', '--danger-foreground': '#A52E22',
  '--neutral-soft': '#EEF0F1', '--neutral-foreground': '#33403D',
  '--disabled': '#E2E5E7', '--disabled-foreground': '#5E6C69',
  '--dot': '#C23A2B', '--amber': '#C26A12', '--lost': '#A85A0E', '--lost-foreground': '#FFFFFF',
  '--photo': '#E8E2D6', '--scrim': 'rgb(19 32 30 / 0.82)', '--toast': '#080B20', '--toast-foreground': '#FFFFFF',
};

// Só o que muda no escuro (o resto vale o do claro).
const DARK_DIFF = {
  '--background': '#0B0F2A', '--foreground': '#F3F5FC', '--card': '#161C4A', '--card-foreground': '#F3F5FC',
  '--popover': '#161C4A', '--popover-foreground': '#F3F5FC',
  '--secondary': '#1F2760', '--secondary-foreground': '#F3F5FC',
  '--muted': '#1F2760', '--muted-foreground': '#A6ADD0',
  '--accent': '#1F2760', '--accent-foreground': '#F3F5FC',
  '--border': '#2B3470', '--input': '#7C87C4', '--ring': '#F3F5FC', '--ring-gap': '#0B0F2A',
  '--sidebar': '#161C4A', '--sidebar-foreground': '#F3F5FC', '--sidebar-primary': '#F3F5FC',
  '--sidebar-primary-foreground': '#0B0F2A', '--sidebar-accent': '#1F2760', '--sidebar-accent-foreground': '#F3F5FC',
  '--sidebar-border': '#2B3470', '--sidebar-ring': '#F3F5FC',
  '--text': '#D8DCF0', '--inset': '#1F2760', '--divider': '#262E66', '--link': '#B8C0E2',
  '--success-soft': '#12392A', '--success-foreground': '#7BD8A2',
  '--warning-soft': '#3B2A10', '--warning-foreground': '#F2B866',
  '--danger-soft': '#4A1C17', '--danger-foreground': '#F3A297',
  '--neutral-soft': '#1F2760', '--neutral-foreground': '#D8DCF0',
  '--disabled': '#1F2760', '--disabled-foreground': '#A6ADD0',
  '--dot': '#F0705F', '--photo': '#2B3470',
};
const DARK = { ...LIGHT, ...DARK_DIFF };

// Não podem ser redefinidas em .dark.
const FIXED_IN_DARK = ['--primary', '--primary-foreground', '--ink', '--brand', '--lost', '--amber', '--destructive', '--toast'];

// Pares da seção 5: [frente, fundo, contraste claro, contraste escuro].
const TEXT_PAIRS = [
  ['foreground', 'background', 15.75, 17.27], ['foreground', 'card', 16.76, 14.84], ['foreground', 'inset', 15.75, 12.7],
  ['text', 'background', 10.17, 13.81], ['text', 'card', 10.82, 11.87], ['text', 'inset', 10.17, 10.16],
  ['muted-foreground', 'background', 5.16, 8.52], ['muted-foreground', 'card', 5.49, 7.32],
  ['muted-foreground', 'muted', 4.8, 6.27], ['muted-foreground', 'inset', 5.16, 6.27],
  ['primary-foreground', 'primary', 7.84, 7.84], ['primary-foreground', 'primary-hover', 6.39, 6.39],
  ['primary-foreground', 'primary-press', 5.03, 5.03],
  ['background', 'foreground', 15.75, 17.27], ['card', 'foreground', 16.76, 14.84],
  ['ink-foreground', 'ink', 16.76, 16.76],
  ['secondary-foreground', 'secondary', 10.07, 12.7], ['accent-foreground', 'accent', 10.07, 12.7],
  ['destructive-foreground', 'destructive', 5.34, 5.34], ['destructive-foreground', 'destructive-hover', 6.97, 6.97],
  ['link', 'background', 10.77, 10.46], ['link', 'card', 11.46, 8.99],
  ['success-foreground', 'success-soft', 6.92, 7.41], ['success-foreground', 'background', 7.41, 10.92],
  ['success-foreground', 'card', 7.88, 9.38],
  ['warning-foreground', 'warning-soft', 6.11, 7.76], ['warning-foreground', 'card', 6.85, 9.1],
  ['danger-foreground', 'danger-soft', 5.86, 7.09], ['danger-foreground', 'card', 6.97, 8.03],
  ['danger-foreground', 'background', 6.55, 9.34],
  ['neutral-foreground', 'neutral-soft', 9.46, 10.16],
  ['lost-foreground', 'lost', 5.08, 5.08],
  ['brand-foreground', 'brand', 11.46, 11.46], ['brand-muted', 'brand', 8.62, 8.62],
  ['primary', 'brand', 5.36, 5.36],
  ['toast-foreground', 'toast', 19.46, 19.46], ['primary', 'toast', 9.11, 9.11],
];
const CONTROL_PAIRS = [
  ['input', 'card', 3.53, 4.71], ['input', 'background', 3.32, 5.48],
  ['ring', 'background', 15.75, 17.27], ['ring', 'card', 16.76, 14.84],
  ['amber', 'card', 3.91, 4.13], ['amber', 'warning-soft', 3.49, 3.52], ['amber', 'background', 3.68, 4.81],
  ['dot', 'card', 5.34, 5.53], ['ink', 'primary', 7.84, 7.84],
];

const TOLERANCE = 0.02;

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const errors = [];
const rootVars = block(':root');
const darkVars = block('.dark');
const lightTheme = rootVars;
const darkTheme = { ...rootVars, ...darkVars };

// 1. Valores das tabelas 2.1 e 2.2 (claro e escuro).
const same = (a, b) => (a ?? '').toLowerCase() === b.toLowerCase();
for (const [name, expected] of Object.entries(LIGHT)) {
  if (!same(lightTheme[name], expected)) {
    errors.push(`claro ${name}: esperado ${expected}, achado ${lightTheme[name] ?? '(ausente)'}`);
  }
}
for (const [name, expected] of Object.entries(DARK)) {
  if (!same(darkTheme[name], expected)) {
    errors.push(`escuro ${name}: esperado ${expected}, achado ${darkTheme[name] ?? '(ausente)'}`);
  }
}

// 2. O escuro não redefine as variáveis fixas.
for (const name of FIXED_IN_DARK) {
  if (name in darkVars) errors.push(`.dark não pode redefinir ${name}`);
}

// 3. Contraste.
function run(title, pairs, min) {
  console.log(`\n${title} (mínimo ${min}:1)`);
  console.log('par'.padEnd(52) + 'claro'.padStart(8) + 'escuro'.padStart(9) + '  contrato (claro/escuro)');
  for (const [fg, bg, expLight, expDark] of pairs) {
    const get = (theme, n) => theme[`--${n}`];
    const cl = contrast(get(lightTheme, fg), get(lightTheme, bg));
    const cd = contrast(get(darkTheme, fg), get(darkTheme, bg));
    const flags = [];
    if (cl < min) flags.push('CLARO ABAIXO DO MÍNIMO');
    if (cd < min) flags.push('ESCURO ABAIXO DO MÍNIMO');
    if (Math.abs(cl - expLight) > TOLERANCE) flags.push(`claro difere do contrato (${expLight})`);
    if (Math.abs(cd - expDark) > TOLERANCE) flags.push(`escuro difere do contrato (${expDark})`);
    console.log(
      `${fg} / ${bg}`.padEnd(52) + cl.toFixed(2).padStart(8) + cd.toFixed(2).padStart(9) +
        `  ${expLight.toFixed(2)} / ${expDark.toFixed(2)}` + (flags.length ? `  <-- ${flags.join('; ')}` : ''),
    );
    for (const f of flags) errors.push(`${fg} / ${bg}: ${f}`);
  }
}
run('Texto', TEXT_PAIRS, 4.5);
run('Controles e ícones', CONTROL_PAIRS, 3.0);

if (errors.length) {
  console.error(`\nFALHOU: ${errors.length} problema(s)`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nok: ${Object.keys(LIGHT).length} variáveis, ${TEXT_PAIRS.length + CONTROL_PAIRS.length} pares.`);
