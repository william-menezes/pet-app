// Revisão do design system Faro (2026-11-21): lima como ação, navy regenerado, Outfit, anel de foco em tinta, tema escuro.
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..', 'artifact-files', '10b9dc4a-768a-4e22-bda7-7275ad258bad', 'project');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(R, f), s, 'utf8');
const changed = new Set();
const rep = (f, from, to, min = 1) => {
  const s = rd(f);
  const n = s.split(from).length - 1;
  if (n < min) throw new Error(f + ': esperava "' + from.slice(0, 60) + '" (' + n + ')');
  wr(f, s.split(from).join(to));
  changed.add(f);
  return n;
};

const NAVY = { 50: '#EEF0F8', 100: '#DADFF0', 200: '#B8C0E2', 300: '#8E9ACF', 400: '#6574B8', 500: '#44549F', 600: '#32418C', 700: '#25337A', 800: '#1A2459', 900: '#0E1336', 950: '#080B20' };
const RING = '0 0 0 2px #FFFFFF, 0 0 0 4px #13201E';

// ---- CSS dos componentes (faro-components.css e a cópia dentro de bundle.css) ----
for (const f of ['faro-components.css', 'components/bundle.css']) {
  rep(f, 'font-family:var(--font-body); font-size:16px; font-weight:600; line-height:1;', 'font-family:var(--font-display); font-size:16px; font-weight:600; line-height:1;');
  rep(f, '.f-control:focus{ outline:none; border-color:var(--primary);', '.f-control:focus{ outline:none; border-color:var(--text-strong);');
  rep(f, '.f-switch input:checked + .track{ background:var(--primary); }', '.f-switch input:checked + .track{ background:var(--text-strong); }');
  rep(f, '.f-check input:checked + .box{ background:var(--primary); border-color:var(--primary); }', '.f-check input:checked + .box{ background:var(--text-strong); border-color:var(--text-strong); }');
  rep(f, '.f-check input:focus-visible + .box{ box-shadow:var(--ring); border-color:var(--primary); }', '.f-check input:focus-visible + .box{ box-shadow:var(--ring); border-color:var(--text-strong); }');
  rep(f, '.f-check.is-radio input:checked + .box{ background:var(--primary); }', '.f-check.is-radio input:checked + .box{ background:var(--text-strong); }');
  rep(f, 'box-shadow:inset 0 0 0 2px var(--primary); }', 'box-shadow:inset 0 0 0 2px var(--text-strong); }');
  rep(f, '.f-bottomnav .active{ color:var(--indigo-700); font-weight:600; }', '.f-bottomnav .active{ color:var(--text-strong); font-weight:600; }');
  rep(f, 'border-radius:50%; background:var(--primary); color:#fff; cursor:pointer;', 'border-radius:50%; background:var(--primary); color:var(--on-primary); cursor:pointer;');
  rep(f, '.f-stat__bar span{ display:block; height:100%; border-radius:3px; background:var(--primary); }', '.f-stat__bar span{ display:block; height:100%; border-radius:3px; background:var(--text-strong); }');
  rep(f, '.f-stepper__bar span.is-done{ background:var(--primary); }', '.f-stepper__bar span.is-done{ background:var(--text-strong); }');
  rep(f, '.f-choice__disc{ background:var(--primary); color:#fff; }', '.f-choice__disc{ background:var(--text-strong); color:#fff; }');
  rep(f, '.f-btn--whats{ background:var(--whats); color:#fff; }', '.f-btn--whats{ background:var(--lime); color:var(--on-lime); }');
  rep(f, '.f-btn--whats:hover{ background:var(--whats-hover); }', '.f-btn--whats:hover{ background:var(--lime-hover); }');
  rep(f, '.f-btn--whats:active{ background:var(--whats-press); }', '.f-btn--whats:active{ background:var(--lime-press); }');
  rep(f, '.f-btn--primary.is-loading::after, .f-btn--danger.is-loading::after, .f-btn--whats.is-loading::after{', '.f-btn--danger.is-loading::after{');
  rep(f, '.f-btn--accent.is-loading::after{', '.f-btn--primary.is-loading::after, .f-btn--whats.is-loading::after, .f-btn--accent.is-loading::after{');
}

// ---- fontes e anel de foco ----
for (const f of ['components/bundle.css', 'tokens/fonts.css']) rep(f, 'family=Poppins:wght@500;600;700', 'family=Outfit:wght@500;600;700');
rep('tokens/fonts.css', 'Poppins (display/headings)', 'Outfit (display/headings/buttons)');
rep('tokens/typography.css', '"Poppins"', '"Outfit"');
rep('tokens/typography.css', 'Poppins (display/headings)', 'Outfit (display/headings/buttons)');
rep('tokens/spacing.css', '--ring: 0 0 0 3px rgba(58,79,214,.40);', '--ring: ' + RING + ';');
rep('guidelines/type-display.card.html', 'Poppins', 'Outfit');

// ---- tokens/colors.css (reescrito) ----
const colorsCss = [
  '/* Faro — Color tokens · revisão 2026-11-21',
  '   Lima age · tinta seleciona · navy é marca · âmbar só no modo perdido.',
  '   Pares de texto validados para WCAG 2.1 AA nos dois temas. */',
  ':root {',
  '  /* ---- Navy (marca), regenerado a partir de #25337A ---- */',
  ...Object.entries(NAVY).map(([k, v]) => '  --navy-' + k + ': ' + v + ';'),
  '  /* Nomes antigos: apelidos de navy-*, para o CSS existente continuar funcionando. */',
  ...Object.keys(NAVY).map((k) => '  --indigo-' + k + ': var(--navy-' + k + ');'),
  '',
  '  /* ---- Lima: a cor de ação (SEMPRE texto escuro sobre lima) ---- */',
  '  --lime:        #84C32E;',
  '  --lime-hover:  #76B027;',
  '  --lime-press:  #689B22;',
  '  --lime-strong: #557F29;',
  '  --on-lime:     #13201E;',
  '',
  '  /* ---- Modo perdido: âmbar ---- */',
  '  --amber:      #C26A12;',
  '  --amber-hover:#A85A0E;',
  '  --amber-soft: #FBF1DD;',
  '  --on-amber:   #FFFFFF;',
  '',
  '  /* ---- Semânticas ---- */',
  '  --success: #157A3F;',
  '  --info:    #1F6FB2;',
  '  --warn:    #946005;',
  '  --danger:  #C23A2B;',
  '  --danger-hover: #A52E22;',
  '  --success-bg: #E4F4EA;',
  '  --info-bg:    #E3F0FA;',
  '  --warn-bg:    #FBF1DD;',
  '  --danger-bg:  #FBE7E4;',
  '',
  '  /* ---- WhatsApp: o botão agora é lima com o ícone oficial; estes verdes ficam só como referência ---- */',
  '  --whats:       #16793D;',
  '  --whats-hover: #126633;',
  '  --whats-press: #0E5229;',
  '',
  '  /* ---- Superfícies e texto ---- */',
  '  --surface-0: #FFFFFF;',
  '  --surface-inset: #F7F8F8;',
  '  --app:       #F7F8F8;',
  '  --divider:   #EEF0F1;',
  '  --border:    #E2E5E7;',
  '  --border-control: #7F8B88;',
  '  --text-strong: #13201E;',
  '  --text:        #33403D;',
  '  --muted:       #5E6C69;',
  '  --selected:    #13201E;',
  '  --on-selected: #FFFFFF;',
  '',
  '  /* ---- Logo ---- */',
  '  --brand-navy:  var(--navy-700);',
  '  --brand-green: var(--lime);',
  '',
  '  /* ---- Apelidos semânticos ---- */',
  '  --primary:        var(--lime);',
  '  --primary-hover:  var(--lime-hover);',
  '  --primary-press:  var(--lime-press);',
  '  --on-primary:     #13201E;',
  '  --accent:         var(--lime);',
  '  --lost-band:      var(--amber-hover);',
  '  --surface-card:   var(--surface-0);',
  '  --surface-app:    var(--app);',
  '  --text-link:      var(--navy-700);',
  '}',
  '',
  '/* Tema escuro: só o app do tutor. Página de resgate, conta, ativação e admin ficam claros. */',
  '[data-theme="dark"] {',
  '  --surface-0: #161C4A;',
  '  --surface-inset: #1F2760;',
  '  --app:       #0B0F2A;',
  '  --divider:   #262E66;',
  '  --border:    #2B3470;',
  '  --border-control: #7C87C4;',
  '  --text-strong: #F3F5FC;',
  '  --text:        #D8DCF0;',
  '  --muted:       #A6ADD0;',
  '  --selected:    #F3F5FC;',
  '  --on-selected: #13201E;',
  '  --text-link:   var(--navy-200);',
  '  --success-bg: #12392A;',
  '  --warn-bg:    #3B2A10;',
  '  --amber-soft: #3B2A10;',
  '  --danger-bg:  #4A1C17;',
  '}',
  '',
].join('\n');
wr('tokens/colors.css', colorsCss);
changed.add('tokens/colors.css');

// ---- tokens.json ----
const tj = JSON.parse(rd('tokens.json'));
tj.color.themes = [{ id: 'light', name: 'Claro' }, { id: 'dark', name: 'Escuro' }];
const byName = new Map(tj.color.tokens.map((t) => [t.name, t]));
const set = (name, value, usage) => {
  const t = byName.get(name);
  if (!t) throw new Error('token ausente: ' + name);
  t.value = value;
  if (usage) t.usage = usage;
};
const NAVY_USE = {
  50: 'Soft navy fill: quiet backgrounds behind navy text.',
  100: 'Secondary text on navy grounds (rescue footer, brand panels): about 8:1 on navy-700.',
  200: 'Links in the dark theme.',
  300: 'Decorative navy tint. Not for text on white.',
  400: 'Input border on hover.',
  500: 'Mid navy; white on it passes AA. Replaces the old vivid indigo, which is gone.',
  600: 'The giant focinho on a navy-700 ground; hover of navy surfaces.',
  700: 'The brand navy: wordmark, brand panels, rescue footer, links. White on it 11.5:1. Not a button colour.',
  800: 'Deep navy surfaces.',
  900: 'Noturno: the base of the dark theme.',
  950: 'Darkest step.',
};
const navyTokens = Object.entries(NAVY).map(([k, v]) => ({ name: 'navy-' + k, value: v, usage: NAVY_USE[k] }));
tj.color.tokens = [...navyTokens, ...tj.color.tokens];
for (const k of Object.keys(NAVY)) set('indigo-' + k, '{navy-' + k + '}', 'Old name kept as an alias of navy-' + k + ' so existing component CSS keeps working. Use navy-' + k + ' in new work.');
set('lime', '#84C32E', 'THE ACTION COLOUR: primary buttons and the one card that asks for an action, always with `on-lime` text (7.8:1). Also the focinho of the logo. Never a selected state, never text or a small mark on white (2.1:1).');
set('primary', '{lime}', 'Primary action fill (alias of `lime`), with `on-primary` text. One per screen.');
set('primary-hover', '{lime-hover}', 'Primary button hover.');
set('primary-press', '{lime-press}', 'Primary button pressed.');
set('on-primary', '#13201E', 'Text and icons on `primary`: ink, never white.');
set('accent', '{lime}', 'Same colour as `primary` since the 2026-11-21 revision; kept for older screens.');
set('text-link', { light: '#25337A', dark: '#B8C0E2' }, 'Inline links: navy-700 on light grounds, navy-200 on dark ones. Underlined.');
set('brand-navy', '{navy-700}', 'Logo colour: the letters of the wordmark.');
set('whats', '#16793D', 'No longer a button fill: the WhatsApp button is lime with the official WhatsApp glyph in ink. Kept for reference.');
set('surface-0', { light: '#FFFFFF', dark: '#161C4A' }, 'Cards, inputs, navigation: the raised surface.');
set('app', { light: '#F7F8F8', dark: '#0B0F2A' }, 'App background behind cards.');
set('divider', { light: '#EEF0F1', dark: '#262E66' }, 'Hairlines between list rows.');
set('border', { light: '#E2E5E7', dark: '#2B3470' }, 'Decorative 1px borders (chips, dividers). Never the only edge of a control.');
set('border-control', { light: '#7F8B88', dark: '#7C87C4' }, '1.5px edge of inputs, checkboxes and the switch off track: at least 3:1 on its surface in both themes.');
set('text-strong', { light: '#13201E', dark: '#F3F5FC' }, 'Headings, labels, input text. In the light theme it is also the ink that marks selection.');
set('text', { light: '#33403D', dark: '#D8DCF0' }, 'Body copy.');
set('muted', { light: '#5E6C69', dark: '#A6ADD0' }, 'Help text, captions, inactive nav labels: at least 4.5:1 on app and card grounds in both themes.');
set('success-bg', { light: '#E4F4EA', dark: '#12392A' });
set('warn-bg', { light: '#FBF1DD', dark: '#3B2A10' });
set('amber-soft', { light: '#FBF1DD', dark: '#3B2A10' });
set('danger-bg', { light: '#FBE7E4', dark: '#4A1C17' });
tj.color.tokens.push(
  { name: 'selected', value: { light: '#13201E', dark: '#F3F5FC' }, usage: 'Fill of the selected chip, segment, nav item, checked box and switched-on toggle. Ink selects; lime never does.' },
  { name: 'on-selected', value: { light: '#FFFFFF', dark: '#13201E' }, usage: 'Text and icons on `selected`.' },
  { name: 'surface-inset', value: { light: '#F7F8F8', dark: '#1F2760' }, usage: 'Icon tiles and map placeholders set inside a card.' }
);
tj.type.families.display = '"Outfit", system-ui, sans-serif';
for (const g of tj.type.groups) {
  for (const st of g.styles) {
    if (st.name === 't-display') { st.fontSize = '46px'; st.lineHeight = 1; st.letterSpacing = '-0.03em'; st.sample = 'Oi, eu sou o Paçoca.'; st.usage = 'The one line that carries a screen: 40–46px on a phone, 56–72px on tablet and desktop.'; }
    if (st.name === 't-h1') st.sample = 'Que bom te ver de novo.';
    if (st.name === 'tag-code') { st.sample = '7K3M-Q9XA-C'; st.usage = 'Legacy style. Tag codes are now set in Outfit 600/700; keep mono only for printed labels.'; }
    if (st.name === 'button') st.usage = 'Button labels (verb + object), set in Outfit 600: 17–18px on primary actions.';
  }
}
const ring = tj.shadow.tokens.find((t) => t.name === 'ring');
ring.value = RING;
ring.usage = 'Focus-visible ring: a 2px white gap, then a solid 2px ink ring. Lime is too light for a ring on white (2.1:1) and the old indigo is gone.';
tj.breakpoint = { tokens: [
  { name: 'bp-tablet', value: '768px', usage: 'From here: icon rail instead of the bottom nav; forms in one centred 480px column.' },
  { name: 'bp-desktop', value: '1200px', usage: 'From here: sidebar with the wordmark; photo or brand panel takes the left half. Screens are drawn at 1440px.' },
] };
tj.meta = Object.assign({}, tj.meta || {}, { revised: '2026-11-21' });
const names = tj.color.tokens.map((t) => t.name);
if (new Set(names).size !== names.length) throw new Error('nome de token duplicado');
wr('tokens.json', JSON.stringify(tj, null, 2));
changed.add('tokens.json');

// ---- cartão da escala e textos do botão ----
const old = ['#EAEDFB', '#CBD3F5', '#A6B3EE', '#7B8CE4', '#566DDD', '#3A4FD6', '#2D3CAC', '#25337A', '#171E58', '#0E1336', '#080B20'];
{
  let s = rd('guidelines/colors-primary.card.html');
  old.forEach((h, i) => { if (!s.includes(h)) throw new Error('cartão sem ' + h); s = s.split(h).join('@@' + i + '@@'); });
  Object.values(NAVY).forEach((v, i) => { s = s.split('@@' + i + '@@').join(v); });
  wr('guidelines/colors-primary.card.html', s);
  changed.add('guidelines/colors-primary.card.html');
}
rep('guidelines/colors-primary.card.html', 'Primary — Índigo', 'Navy — marca');
rep('guidelines/colors-primary.card.html', '500 is the action color (AA on white text)', '700 is the brand colour; lime is the action colour');
rep('guidelines/colors-accent.card.html', 'accent · CTA 2º', 'ação principal');
rep('components/Button/README.md', 'one indigo `primary` per screen', 'one lime `primary` (dark text) per screen');
rep('components/buttons/Button.jsx', '`primary` (indigo)', '`primary` (lime, dark text)');

// ---- README e índice ----
fs.copyFileSync(path.join(__dirname, 'README.md'), path.join(R, 'README.md'));
changed.add('README.md');
const idx = JSON.parse(rd('design-system.json'));
idx.lastChange = { by: 'William', at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), via: 'Claude Code', note: 'Tag MVP revision: lime is the action colour, navy scale regenerated from #25337A (vivid indigo removed), headings in Outfit, ink focus ring, dark theme tokens, three breakpoints.' };
wr('design-system.json', JSON.stringify(idx, null, 2));
console.log([...changed].sort().join('\n'));
