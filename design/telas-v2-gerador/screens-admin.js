// Painel admin (sempre no tema claro).
const { FD, FB, L: T, LOGO, pick, fname, ico, page, h1, h2, para, btn, textLink, badge, chip, chipRow, tile40, row, group, infoCard, logoImg } = require('./lib');

const to = (b, S) => fname(b, S, T);
const NAV = [['Lotes', 'list', 'admin-lotes'], ['Códigos', 'qr', 'admin-codigos'], ['Fila de scans', 'scan', null], ['Auditoria', 'clock', null]];
const adminBadge = () => `<span style="display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; background: ${T.selBg}; color: ${T.selFg}; font-size: 12px; font-weight: 600">Admin</span>`;
const shell = (S, h, title, active, body) => {
  const items = NAV.map(([t, i, b]) => ({ t, i, on: t === active, href: b ? to(b, S) : '#' }));
  if (S.k === 'd') {
    return page(title + ' · desktop', S.w, h, T, 'flex-direction: row', `<nav aria-label="Navegação do admin" style="width: 264px; flex-shrink: 0; background: ${T.card}; padding: 24px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 22px">${logoImg(LOGO, 48)}${adminBadge()}</div>
${items.map((n) => `<a href="${n.href}"${n.on ? ' aria-current="page"' : ''} style="height: 48px; padding: 0 16px; border-radius: 999px; ${n.on ? `background: ${T.selBg}; color: ${T.selFg}` : `color: ${T.text}`}; display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 15px; font-weight: 600">${ico(n.i, 20, n.on ? T.selFg : T.text)}${n.t}</a>`).join('\n')}
</nav>
<div style="flex-grow: 1; min-width: 0; padding: 32px 48px; display: flex; flex-direction: column; gap: 20px">
${body}
</div>`);
  }
  return page(title + pick(S, ' · celular', ' · tablet', ''), S.w, h, T, 'flex-direction: column', `<div style="background: ${T.card}; padding: ${pick(S, '12px 16px 10px', '16px 28px 12px', '')}; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px">${logoImg(LOGO, pick(S, 40, 44, 44))}${adminBadge()}</div>
<nav aria-label="Navegação do admin" style="display: flex; gap: 6px; overflow-x: auto">${items.map((n) => `<a href="${n.href}"${n.on ? ' aria-current="page"' : ''} style="height: 40px; padding: 0 14px; border-radius: 999px; flex-shrink: 0; ${n.on ? `background: ${T.selBg}; color: ${T.selFg}` : `color: ${T.text}`}; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-size: 14px; font-weight: 600">${ico(n.i, 18, n.on ? T.selFg : T.text)}${n.t}</a>`).join('')}</nav>
</div>
<div style="flex-grow: 1; padding: ${pick(S, '18px 16px 20px', '24px 28px', '')}; display: flex; flex-direction: column; gap: ${pick(S, 14, 18, 20)}px">
${body}
</div>`);
};
const titleBlock = (S, t, p, action) => `<div style="display: flex; flex-direction: ${S.k === 'm' ? 'column' : 'row'}; align-items: ${S.k === 'm' ? 'stretch' : 'flex-end'}; justify-content: space-between; gap: 14px; flex-shrink: 0"><div>${h1(T, t, pick(S, 30, 34, 36))}${para(T, p, 15, 8)}</div>${action || ''}</div>`;
// Tabela em grade; no celular vira lista de cartões.
const table = (cols, rows) => `<div style="background: ${T.card}; border-radius: 20px; padding: 6px 20px; display: flex; flex-direction: column; flex-shrink: 0">
<div style="display: grid; grid-template-columns: ${cols.map((c) => c[1]).join(' ')}; gap: 12px; align-items: center; min-height: 44px; border-bottom: 1px solid ${T.line}">${cols.map((c) => `<span style="font-size: 13px; font-weight: 600; color: ${T.muted}">${c[0]}</span>`).join('')}</div>
${rows.map((r, i) => `<${r.href ? `a href="${r.href}"` : 'div'} style="display: grid; grid-template-columns: ${cols.map((c) => c[1]).join(' ')}; gap: 12px; align-items: center; min-height: 56px; ${i < rows.length - 1 ? `border-bottom: 1px solid ${T.line}; ` : ''}text-decoration: none; color: ${T.strong}; font-size: 14px">${r.cells.map((c) => `<span style="min-width: 0">${c}</span>`).join('')}</${r.href ? 'a' : 'div'}>`).join('\n')}
</div>`;
const code = (c) => `<span style="${FD}; font-size: 16px; font-weight: 600; letter-spacing: 0.01em">${c}</span>`;
const muted = (t) => `<span style="color: ${T.muted}">${t}</span>`;
const check = (label, on) => `<input type="checkbox" aria-label="${label}"${on ? ' checked' : ''} style="width: 20px; height: 20px; margin: 0; accent-color: ${T.selBg}"></input>`;
const STATUS = { Ativo: 'ok', 'Disponível': 'neu', Bloqueado: 'amber', Anulado: 'danger' };

// ----- Lotes -----
const lotes = (S, h) => {
  const counters = [['Códigos gerados', '54', '1 lote'], ['Disponíveis', '41', 'prontos para venda'], ['Ativos', '12', 'vinculados a pets'], ['Anulados', '1', '2ª via por perda']];
  const cGrid = `<div style="display: grid; grid-template-columns: repeat(${pick(S, 2, 4, 4)}, minmax(0, 1fr)); gap: ${pick(S, 12, 14, 20)}px; flex-shrink: 0">${counters.map(([l, n, c]) => `<div style="background: ${T.card}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: ${T.muted}">${l}</span><span style="${FD}; font-size: ${pick(S, 34, 34, 40)}px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em">${n}</span><span style="font-size: 13px; color: ${T.muted}">${c}</span></div>`).join('')}</div>`;
  const baixado = badge(T, 'Baixado', 'ok');
  const list = pick(S,
    `<div style="background: ${T.card}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 8px"><div style="display: flex; align-items: center; justify-content: space-between">${code('lote-001')}${baixado}</div><span style="font-size: 14px; color: ${T.text}">17 nov 2026 · 54 códigos · 12 ativos</span><span style="font-size: 13px; color: ${T.muted}">Primeira impressão · rebaixo 22 mm</span></div>`,
    table([['Lote', '1.2fr'], ['Criado em', '1.2fr'], ['Qtd.', '0.6fr'], ['Ativos', '0.6fr'], ['Pacote', '1fr']], [{ cells: [code('lote-001'), '17 nov 2026', '54', '12', baixado] }]),
    table([['Lote', '1fr'], ['Criado em', '1fr'], ['Qtd.', '0.5fr'], ['Ativos', '0.5fr'], ['Pacote', '0.8fr'], ['Observação', '2fr']], [{ cells: [code('lote-001'), '17 nov 2026', '54', '12', baixado, muted('Primeira impressão · rebaixo 22 mm')] }]));
  return shell(S, h, 'Admin: lotes', 'Lotes', `${titleBlock(S, 'Lotes de tags', 'Cada lote gera os códigos, o PDF das etiquetas e os PINs dos cartões.', btn(T, 'Criar lote', { icon: 'plus', full: S.k === 'm' }))}
${cGrid}
${list}
${infoCard(T, 'info', 'O pacote de um lote aparece uma vez só', 'O PDF das etiquetas pode ser reimpresso depois, mas os PINs só existem no download original. Guarde o arquivo até imprimir os cartões.')}`);
};

// ----- Códigos -----
const ROWS = [['7K3M-Q9XA-C', 'Ativo', 'Paçoca · Ana S.', 'Hoje, 14:32'], ['2FX8-CN73-F', 'Disponível', '—', '—'], ['03RZ-68EH-W', 'Ativo', 'Luna · Bruno M.', '15 nov'], ['YRDZ-0QAZ-D', 'Bloqueado', '—', '12 nov'], ['PYC6-D7XD-3', 'Anulado', 'Thor · Carla R.', '08 nov'], ['9QS4-P7AM-4', 'Disponível', '—', '—']];
const codigos = (S, h) => {
  const search = `<div style="position: relative; flex-grow: 1; min-width: 0"><span style="position: absolute; left: 16px; top: 15px">${ico('search', 20, T.muted)}</span><input type="search" aria-label="Buscar código, pet ou tutor" placeholder="Buscar código, pet ou tutor" style="height: 50px; width: 100%; box-sizing: border-box; border-radius: 999px; border: 1.5px solid ${T.control}; background: ${T.card}; padding: 0 18px 0 46px; ${FB}; font-size: 16px; color: ${T.strong}"></input></div>`;
  const filters = `<div style="display: flex; gap: 8px; overflow-x: auto; flex-shrink: 0">${['Todos', 'Disponíveis', 'Ativos', 'Bloqueados', 'Anulados'].map((t, i) => chip(T, t, i === 0)).join('')}</div>`;
  const href = to('admin-codigo', S);
  const list = pick(S,
    `<div style="display: flex; flex-direction: column; gap: 10px">${ROWS.map(([c, s, who, last]) => `<a href="${href}" style="background: ${T.card}; border-radius: 20px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: ${T.strong}"><div style="display: flex; align-items: center; justify-content: space-between">${code(c)}${badge(T, s, STATUS[s])}</div><span style="font-size: 14px; color: ${T.text}">${who === '—' ? 'Sem vínculo' : who}</span><span style="font-size: 13px; color: ${T.muted}">${last === '—' ? 'Nunca escaneada' : 'Último scan: ' + last}</span></a>`).join('')}</div>`,
    table([['', '28px'], ['Código', '1.4fr'], ['Situação', '1fr'], ['Pet e tutor', '1.5fr'], ['Último scan', '1fr']], ROWS.map(([c, s, who, last], i) => ({ href, cells: [check('Selecionar ' + c, i === 0), code(c), badge(T, s, STATUS[s]), who, muted(last)] }))),
    table([['', '28px'], ['Código', '1.2fr'], ['Lote', '0.8fr'], ['Situação', '0.9fr'], ['Pet e tutor', '1.5fr'], ['Último scan', '1fr']], ROWS.map(([c, s, who, last], i) => ({ href, cells: [check('Selecionar ' + c, i === 0), code(c), muted('lote-001'), badge(T, s, STATUS[s]), who, muted(last)] }))));
  return shell(S, h, 'Admin: códigos', 'Códigos', `${titleBlock(S, 'Códigos', '54 códigos em 1 lote.', btn(T, 'Reimprimir seleção', { kind: 'outline', icon: 'print', full: S.k === 'm' }))}
<div style="display: flex; flex-shrink: 0">${search}</div>
${filters}
${list}`);
};

// ----- Detalhe do código -----
const kv = (k, v) => `<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; min-height: 40px; font-size: 14px"><span style="color: ${T.muted}; flex-shrink: 0">${k}</span><span style="text-align: right; color: ${T.strong}">${v}</span></div>`;
const box = (title, inner) => `<div style="background: ${T.card}; border-radius: 20px; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0">${h2(T, title, 18)}${inner}</div>`;
const detalhe = (S, h) => {
  const vinculo = box('Vínculo atual', kv('Pet', 'Paçoca · cão') + kv('Tutor', 'Ana Souza · ana@email.com') + kv('Desde', '02 nov 2026') + kv('PIN', 'Usado em 02 nov · tentativas erradas: 0'));
  const scans = box('Scans', [['Hoje, 14:32', 'Aproximada (IP)', '~3 km'], ['16 nov, 09:10', 'Precisa (GPS)', '± 15 m'], ['02 nov, 18:47', 'Precisa (GPS)', '± 30 m']].map(([a, b, c], i) => `<div style="display: grid; grid-template-columns: 1.2fr 1.2fr 0.7fr; gap: 12px; align-items: center; min-height: 44px; ${i < 2 ? `border-bottom: 1px solid ${T.line}; ` : ''}font-size: 14px"><span style="font-weight: 600">${a}</span><span style="color: ${T.text}">${b}</span><span style="color: ${T.muted}; text-align: right">${c}</span></div>`).join(''));
  const hist = box('Histórico de vínculos', para(T, 'Sem vínculos anteriores.', 14, 0));
  const acoes = `<div style="display: flex; flex-direction: column; gap: 8px">${h2(T, 'Ações', 18)}${group(T, [
    row(T, { icon: 'block', title: 'Bloquear código', sub: 'Quem escanear vê “tag não encontrada”', href: '#' }),
    row(T, { icon: 'lock', title: 'Reemitir PIN', sub: 'Para cartão perdido', href: '#' }),
    row(T, { icon: 'close', title: 'Encerrar vínculo', sub: 'Suporte e realocação', href: '#' }),
    row(T, { icon: 'print', title: 'Reimprimir QR', sub: 'Mesma versão e máscara', href: '#' }),
    row(T, { icon: 'tag', title: 'Trocar código (2ª via)', sub: 'Tag perdida: código novo, o antigo é anulado', href: '#' }),
    row(T, { icon: 'warn', tone: 'danger', title: 'Anular código', sub: 'Definitivo; o histórico fica guardado', href: '#' }),
  ])}</div>`;
  const colS = (g, inner) => `<div style="display: flex; flex-direction: column; gap: ${g}px; min-width: 0">${inner}</div>`;
  return shell(S, h, 'Admin: detalhe do código', 'Códigos', `<div style="display: flex; flex-direction: column; gap: 10px; flex-shrink: 0"><a href="${to('admin-codigos', S)}" style="display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; min-height: 44px; font-size: 14px; font-weight: 600; text-underline-offset: 3px">${ico('back', 18, T.link)}Códigos</a>
<div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">${h1(T, '7K3M-Q9XA-C', pick(S, 32, 40, 44), 'letter-spacing: 0')}${badge(T, 'Ativo', 'ok')}</div>${para(T, 'lote-001 · criado em 17 nov 2026', 15, 0)}</div>
${pick(S, `${vinculo}${acoes}${scans}${hist}`, `${vinculo}${acoes}${scans}${hist}`, `<div style="display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px">${colS(20, vinculo + scans + hist)}${colS(20, acoes)}</div>`)}`);
};

module.exports = [
  { base: 'admin-lotes', name: 'Admin · lotes', group: 'admin', H: { m: 980, t: 1024, d: 900 }, fn: (S, T_, h) => lotes(S, h) },
  { base: 'admin-codigos', name: 'Admin · códigos', group: 'admin', H: { m: 1180, t: 1024, d: 900 }, fn: (S, T_, h) => codigos(S, h) },
  { base: 'admin-codigo', name: 'Admin · detalhe do código', group: 'admin', H: { m: 1560, t: 1500, d: 900 }, fn: (S, T_, h) => detalhe(S, h) },
];
