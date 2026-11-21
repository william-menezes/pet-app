// Gera os ícones do app a partir do focinho de public/logos/logo-compact.svg (spec 002, T060, research §R13).
// Focinho lima centralizado sobre navy. Usa o Chromium do Playwright; sem dependência nova.
// Uso: node scripts/generate-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAVY = '#25337A';
const LIME = '#84C32E';
// Proporção do desenho recortado do focinho (viewBox "20 20 234 207").
const VIEW = { x: 20, y: 20, w: 234, h: 207 };

const source = readFileSync(join(root, 'public/logos/logo-compact.svg'), 'utf8');
const d = /<path[^>]*\sd="([^"]+)"/.exec(source)?.[1];
if (!d) throw new Error('logo-compact.svg: não achei o atributo d do <path>');

/** SVG do focinho com `percent` da largura de um quadrado/retângulo W x H, centralizado. */
function paw(width, height, percent) {
  const w = width * percent;
  const h = (w * VIEW.h) / VIEW.w;
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}"><path fill="${LIME}" fill-rule="evenodd" clip-rule="evenodd" d="${d}"/></svg>`;
}

const outputs = [
  { file: 'icons/icon-192x192.png', size: 192, percent: 0.72 },
  { file: 'icons/icon-512x512.png', size: 512, percent: 0.72 },
  { file: 'icons/icon-maskable-192x192.png', size: 192, percent: 0.52 },
  { file: 'icons/icon-maskable-512x512.png', size: 512, percent: 0.52 },
  { file: 'icons/apple-touch-icon.png', size: 180, percent: 0.68 },
  { file: 'icons/favicon-32x32.png', size: 32, percent: 0.78 },
];
const icoSizes = [32, 48];

mkdirSync(join(root, 'public/icons'), { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

async function render(size, percent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${NAVY}"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="${NAVY}"/>${paw(size, size, percent)}</svg></body></html>`,
  );
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
}

const written = [];
for (const { file, size, percent } of outputs) {
  const png = await render(size, percent);
  writeFileSync(join(root, 'public', file), png);
  written.push({ file: join('public', file), size, png });
}

const icoImages = [];
for (const size of icoSizes) icoImages.push({ size, png: await render(size, 0.78) });
await browser.close();

// favicon.svg: quadrado de 64px com cantos arredondados e o focinho com 72% da largura.
writeFileSync(
  join(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${NAVY}"/>${paw(64, 64, 0.72)}</svg>\n`,
);

// favicon.ico: cabeçalho de 6 bytes, 16 bytes por imagem, depois os PNGs inteiros (little-endian).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
const entries = Buffer.alloc(16 * icoImages.length);
let offset = 6 + entries.length;
icoImages.forEach(({ size, png }, i) => {
  const at = i * 16;
  entries.writeUInt8(size, at);
  entries.writeUInt8(size, at + 1);
  entries.writeUInt8(0, at + 2);
  entries.writeUInt8(0, at + 3);
  entries.writeUInt16LE(1, at + 4);
  entries.writeUInt16LE(32, at + 6);
  entries.writeUInt32LE(png.length, at + 8);
  entries.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
writeFileSync(join(root, 'public/favicon.ico'), Buffer.concat([header, entries, ...icoImages.map((i) => i.png)]));

// Confere a largura e a altura gravadas em cada PNG (bytes 16 a 23).
const problems = [];
for (const { file, size, png } of [...written, ...icoImages.map(({ size, png }) => ({ file: `favicon.ico (${size}px)`, size, png }))]) {
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (w !== size || h !== size) problems.push(`${file}: esperado ${size}x${size}, achei ${w}x${h}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`ok: ${written.length} PNGs, favicon.svg e favicon.ico (${icoImages.map((i) => i.size).join(' e ')}px)`);
