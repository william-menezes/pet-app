// Atualiza o guia "Faro on ZardUI" para a revisão de 2026-11-21.
const fs = require('fs');
const path = require('path');

const f = path.join(__dirname, '..', 'artifact-files', '10b9dc4a-768a-4e22-bda7-7275ad258bad', 'project', 'zardui.md');
let s = fs.readFileSync(f, 'utf8');
const miss = [];
const rep = (from, to) => {
  const isRe = from instanceof RegExp;
  const hit = isRe ? from.test(s) : s.includes(from);
  if (!hit) { miss.push(String(from).slice(0, 70)); return; }
  s = isRe ? s.replace(from, to) : s.split(from).join(to);
};

rep(/--primary: #3A4FD6;(\s+)--primary-foreground: #FFFFFF;(\s+)\/\* 6\.4:1 \*\//, '--primary: #84C32E;$1--primary-foreground: #13201E;$2/* lime acts, 7.8:1 */');
rep('--primary-hover: #2D3CAC; --primary-press: #25337A;', '--primary-hover: #76B027; --primary-press: #689B22;');
rep(/--secondary: #EAEDFB;/, '--secondary: #EEF0F8;');
rep(/--accent: #EAEDFB;/, '--accent: #EEF0F8;');
rep('--ring: #3A4FD6;', '--ring: #13201E;');
rep('--chart-1: #3A4FD6;', '--chart-1: #25337A;');
rep('--chart-5: #7B8CE4;', '--chart-5: #8E9ACF;');
rep('--sidebar-primary: #3A4FD6;', '--sidebar-primary: #13201E;');
rep('--sidebar-accent: #EAEDFB;', '--sidebar-accent: #EEF0F8;');
rep('--sidebar-ring: #3A4FD6;', '--sidebar-ring: #13201E;');
const scale = { 50: ['#EAEDFB', '#EEF0F8'], 100: ['#CBD3F5', '#DADFF0'], 200: ['#A6B3EE', '#B8C0E2'], 300: ['#7B8CE4', '#8E9ACF'], 400: ['#566DDD', '#6574B8'], 500: ['#3A4FD6', '#44549F'], 600: ['#2D3CAC', '#32418C'], 800: ['#171E58', '#1A2459'] };
for (const [k, [a, b]] of Object.entries(scale)) rep('--color-indigo-' + k + ': ' + a, '--color-indigo-' + k + ': ' + b);
rep("--font-display: 'Poppins', system-ui, sans-serif;", "--font-display: 'Outfit', system-ui, sans-serif;");
rep('border-transparent text-base font-semibold', 'border-transparent font-display text-base font-semibold');
rep(/whatsapp:(\s+)'[^']*',[^\n]*/, "whatsapp:$1'bg-lime text-lime-foreground hover:bg-lime-hover active:bg-lime-press',   // lime, with the official WhatsApp glyph in ink");
rep(/link:(\s+)'text-indigo-600 underline-offset-4 hover:underline'/, "link:$1'text-indigo-700 underline underline-offset-4'");
rep(/accent:(\s+)'bg-lime text-lime-foreground hover:bg-lime-hover active:bg-lime-press',[^\n]*/, "accent:$1'bg-lime text-lime-foreground hover:bg-lime-hover active:bg-lime-press',   // same as default since 2026-11-21; kept for older screens");
rep('There is no dark theme yet: leave `.dark` out until Faro designs one.', 'The tutor app has a dark theme (section 5); the public rescue page, the account and activation flows and the admin never get `.dark`.');
rep("replaces Tailwind's indigo scale with Faro's so `bg-indigo-600` means Faro's indigo", "replaces Tailwind's indigo scale with Faro's navy (regenerated from `#25337A`) so `bg-indigo-700` means Faro's navy");
rep(/:focus-visible \{ outline: 2px solid var\(--ring\); outline-offset: 2px; \}/, ':focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }   /* --ring is ink, not lime: lime on white is 2.1:1 */');
rep('Self-host Inter, Poppins and JetBrains Mono', 'Self-host Inter and Outfit');
rep('## 1. Theme: `src/styles.css`', [
  '> **Revised 2026-11-21 for the tag MVP.** Four colour rules now drive every component: **lime acts** (`bg-primary`, dark text), **ink selects** (`bg-foreground text-background` on the chosen chip, segment, nav item, checkbox and switch), **navy is the brand** (panels, footer, links) and **amber is only lost mode**. Headings and button labels are **Outfit**. WhatsApp and Google buttons carry the companies\' own glyphs.',
  '',
  '## 1. Theme: `src/styles.css`',
].join('\n'));

s += [
  '',
  '## 5. Dark theme and breakpoints',
  '',
  'Only the authenticated tutor app gets the dark theme. Add the class on the tutor shell, never on `:root`, so the public and account routes stay light.',
  '',
  '```css',
  '.dark {',
  '  --background: #0B0F2A;  --foreground: #F3F5FC;',
  '  --card: #161C4A;        --card-foreground: #F3F5FC;',
  '  --popover: #161C4A;     --popover-foreground: #F3F5FC;',
  '  --secondary: #1F2760;   --secondary-foreground: #F3F5FC;',
  '  --muted: #1F2760;       --muted-foreground: #A6ADD0;   /* 6.0:1 on card */',
  '  --accent: #1F2760;      --accent-foreground: #F3F5FC;',
  '  --border: #2B3470;      --input: #7C87C4;              /* 3:1 or better on card and background */',
  '  --ring: #F3F5FC;',
  '  --text: #D8DCF0;',
  '  --success-soft: #12392A; --warning-soft: #3B2A10; --danger-soft: #4A1C17;',
  '  /* --primary (lime), --lost and the navy scale do not change */',
  '}',
  '```',
  '',
  'Selection flips with the theme because it is written as `bg-foreground text-background`: an ink pill on light, a light pill on dark. Links use `text-indigo-700` on light and `dark:text-indigo-200`. Use the white-letter wordmark on dark grounds.',
  '',
  'Breakpoints, mobile first: the base styles are the 390px phone layout; `md:` (768px) swaps the bottom nav for the icon rail and centres forms in one 480px column; `xl:` (1280px) brings the sidebar with the wordmark and puts the photo or the navy brand panel on the left half. Screens are drawn at 390, 768 and 1440.',
  '',
  'The Google "G" is the official four-colour SVG, inlined in the button; it is not a Boxicons glyph.',
  '',
].join('\n');

fs.writeFileSync(f, s, 'utf8');
console.log('não encontrados:', miss.length ? '\n  ' + miss.join('\n  ') : 'nenhum');
