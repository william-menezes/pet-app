// Gera todas as telas do "MVP v2", o manifesto para o canvas e a checagem de contraste.
const { fs, path, OUT, L, D, SZ, NAVY, fname } = require('./lib');
const screens = [...require('./screens-public'), ...require('./screens-flow'), ...require('./screens-app'), ...require('./screens-admin')];

const manifest = [];
for (const s of screens) {
  for (const k of ['m', 't', 'd']) {
    const S = SZ[k];
    const themes = s.dark && k !== 't' ? [L, D] : [L];
    for (const T of themes) {
      const file = fname(s.base, S, T);
      const h = s.H[k];
      const html = s.fn(S, T, h);
      if (/undefined|NaN|\[object/.test(html)) throw new Error('valor inválido em ' + file);
      fs.writeFileSync(path.join(OUT, file), html, 'utf8');
      manifest.push({ file, base: s.base, name: s.name, group: s.group, k, w: S.w, h, dark: !!T.dark });
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
console.log('telas:', manifest.length, 'bytes:', manifest.reduce((a, m) => a + fs.statSync(path.join(OUT, m.file)).size, 0));

// Links entre telas: todo href para um artboard deve existir.
const names = new Set(manifest.map((m) => m.file));
const broken = new Set();
for (const m of manifest) {
  const html = fs.readFileSync(path.join(OUT, m.file), 'utf8');
  for (const mm of html.matchAll(/href="([^"#][^"]*\.dc\.html)"/g)) if (!names.has(mm[1])) broken.add(m.file + ' -> ' + mm[1]);
}
console.log('links quebrados:', broken.size ? [...broken].join('\n  ') : 'nenhum');

// Contraste (WCAG) dos pares usados nas telas.
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const pairs = (T) => [
  ['strong/bg', T.strong, T.bg, 4.5], ['text/bg', T.text, T.bg, 4.5], ['muted/bg', T.muted, T.bg, 4.5], ['strong/card', T.strong, T.card, 4.5], ['text/card', T.text, T.card, 4.5], ['muted/card', T.muted, T.card, 4.5], ['muted/inset', T.muted, T.inset, 4.5],
  ['selFg/selBg', T.selFg, T.selBg, 4.5], ['onLime/lime', T.onLime, T.lime, 4.5], ['link/bg', T.link, T.bg, 4.5], ['link/card', T.link, T.card, 4.5],
  ['amber', T.amberFg, T.amberBg, 4.5], ['amberFg/card', T.amberFg, T.card, 4.5], ['ok', T.okFg, T.okBg, 4.5], ['okFg/card', T.okFg, T.card, 4.5], ['okFg/bg', T.okFg, T.bg, 4.5], ['neu', T.neuFg, T.neuBg, 4.5], ['danger', T.dangerFg, T.dangerBg, 4.5], ['dangerFg/bg', T.dangerFg, T.bg, 4.5],
  ['control/card (3:1)', T.control, T.card, 3], ['control/bg (3:1)', T.control, T.bg, 3], ['strong/inset', T.strong, T.inset, 4.5],
];
const fixed = [['branco/lost', '#FFFFFF', '#A85A0E', 4.5], ['navy100/navy700', NAVY[100], NAVY[700], 4.5], ['lima/navy700', '#84C32E', NAVY[700], 4.5], ['branco/navy700', '#FFFFFF', NAVY[700], 4.5], ['amberFg/branco', '#8A4A0C', '#FFFFFF', 4.5], ['tinta/lima', '#13201E', '#84C32E', 4.5], ['text/photoBg', '#33403D', '#E8E2D6', 4.5]];
let fails = 0;
for (const [nm, T] of [['claro', L], ['escuro', D]]) for (const [n, f, b, min] of pairs(T)) { const v = cr(f, b); if (v < min) { fails++; console.log('FALHA', nm, n, f, b, v.toFixed(2)); } }
for (const [n, f, b, min] of fixed) { const v = cr(f, b); if (v < min) { fails++; console.log('FALHA', n, v.toFixed(2)); } }
console.log('contraste: falhas =', fails);
console.log('disabled claro', cr(L.disFg, L.disBg).toFixed(2), 'escuro', cr(D.disFg, D.disBg).toFixed(2));
