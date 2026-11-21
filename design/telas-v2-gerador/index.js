// Atualiza só as chaves do "MVP v2" no índice do canvas, a partir do manifesto.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', 'artifact-files', 'ad93d784-0dac-4303-ac1e-7b55bf3b4ba3', 'project');
const idx = JSON.parse(fs.readFileSync(path.join(R, 'canvas.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const PAGES = [['v2', 'MVP v2 · página pública', (m) => m.group === 'pub'], ['v2c', 'MVP v2 · conta', (m) => m.group === 'conta'], ['v2f', 'MVP v2 · ativação e novo pet', (m) => m.group === 'ativ'], ['v2a', 'MVP v2 · app do tutor', (m) => m.group === 'app' && !m.dark], ['v2e', 'MVP v2 · app do tutor (escuro)', (m) => m.group === 'app' && m.dark], ['v2adm', 'MVP v2 · admin', (m) => m.group === 'admin']];
for (const k of Object.keys(idx.boards)) if (k.startsWith('V2-')) delete idx.boards[k];
idx.order = idx.order.filter((k) => !k.startsWith('V2-'));
for (const k of Object.keys(idx.notes)) if (k.startsWith('v2')) delete idx.notes[k];
idx.pages = idx.pages.filter((p) => !p.id.startsWith('v2'));
const LABEL = { m: 'celular 390', t: 'tablet 768', d: 'desktop 1440' };
for (const [id, name, pred] of PAGES) {
  idx.pages.push({ id, name });
  const items = man.filter(pred);
  const bases = [...new Set(items.map((m) => m.base))];
  let y = 0;
  bases.forEach((b, i) => {
    const row = items.filter((m) => m.base === b);
    let x = 0;
    for (const m of row) {
      idx.boards[m.file] = { x, y, w: m.w, h: m.h, title: `${m.name} · ${LABEL[m.k]}${m.dark ? ' · escuro' : ''}`, page: id };
      idx.order.push(m.file);
      x += m.w + 80;
    }
    idx.notes[`${id}t${i}`] = { x: 0, y: y - 300, text: row[0].name, kind: 'title1', maxW: x - 80, page: id };
    y += Math.max(...row.map((m) => m.h)) + 420;
  });
}
idx.notes.v2s1 = { x: 2838, y: 0, w: 380, page: 'v2', fill: 'green', text: 'Regras aplicadas em todas as telas v2:\n\n• Títulos em Outfit, texto em Inter.\n• Lima age: só botões principais e o cartão que pede uma ação.\n• Tinta (quase preto) seleciona: aba ativa, caixa marcada, interruptor ligado.\n• Navy é marca: rodapé, painéis e links.\n• Âmbar só no modo perdido.\n• WhatsApp e Google com o ícone oficial.\n• O focinho gigante assina os momentos de marca.\n• Três larguras por tela: celular, tablet e desktop.\n• Tema escuro só no app do tutor (celular e desktop).' };
fs.writeFileSync(path.join(R, 'canvas.json'), JSON.stringify(idx, null, 2), 'utf8');
const files = { };
for (const m of man) files['project/' + m.file] = 'project/' + m.file;
fs.writeFileSync(path.join(__dirname, 'files.json'), JSON.stringify(files), 'utf8');
console.log('boards v2:', Object.keys(idx.boards).filter((k) => k.startsWith('V2-')).length, 'pages:', idx.pages.map((p) => p.id).join(','), 'total boards:', Object.keys(idx.boards).length, 'order:', idx.order.length);
