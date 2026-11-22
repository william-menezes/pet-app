// App do tutor (tema claro e escuro).
const { FD, FB, NAVY, pick, fname, ico, focinho, grow, h2, para, btn, iconBtn, textLink, badge, chip, tagChip, chipRow, tile40, card, toggle, row, group, sectionLabel, field, avatar, note, photo, app } = require('./lib');

const hero = (T, h, nameSize, radius, sub, href) => `<${href ? `a href="${href}"` : 'div'} style="position: relative; display: block; height: ${h}px; flex-shrink: 0; border-radius: ${radius}px; overflow: hidden; background: ${T.photoBg}; text-decoration: none">
${photo('center 30%')}
<span style="position: absolute; left: 0; right: 0; bottom: 0; height: ${Math.round(h * 0.55)}px; background: linear-gradient(to top, rgba(19,32,30,0.82), rgba(19,32,30,0))"></span>
${href ? `<span style="position: absolute; top: 14px; left: 14px; display: inline-flex; align-items: center; gap: 4px; height: 36px; padding: 0 10px 0 14px; border-radius: 999px; background: #FFFFFF; color: #13201E; font-size: 14px; font-weight: 600">Paçoca${ico('down', 18, '#13201E')}</span>` : ''}
<span style="position: absolute; left: 18px; right: 18px; bottom: 16px; display: flex; flex-direction: column; gap: 4px"><span style="${FD}; font-size: ${nameSize}px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; color: #FFFFFF">Paçoca</span><span style="font-size: 14px; color: #FFFFFF">${sub}</span></span>
</${href ? 'a' : 'div'}>`;
const limeCard = (S, T, pad, hs, ps) => `<div style="background: ${T.lime}; border-radius: 24px; padding: ${pad}px; display: flex; flex-direction: column; flex-shrink: 0">
<h2 style="margin: 0; ${FD}; font-size: ${hs}px; line-height: 1.12; font-weight: 700; letter-spacing: -0.02em; color: #13201E">Alguém escaneou a tag do Paçoca</h2>
<p style="margin: 8px 0 0; font-size: ${ps}px; line-height: 1.45; color: #13201E">Hoje às 14:32, localização aproximada. Ninguém entrou em contato ainda.</p>
<div style="flex-grow: 1; min-height: 14px"></div>
<a href="${fname('scans', S, T)}" style="align-self: flex-start; height: 44px; padding: 0 18px; border-radius: 999px; background: #13201E; color: #FFFFFF; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; ${FD}; font-size: 15px; font-weight: 600">${ico('pin', 18, '#FFFFFF')}Ver no mapa</a></div>`;
const tile = (T, label, num, cap, href, size = 38) => `<a href="${href}" style="background: ${T.card}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: ${T.strong}"><span style="font-size: 13px; color: ${T.muted}">${label}</span><span style="${FD}; font-size: ${size}px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em">${num}</span><span style="font-size: 13px; color: ${T.muted}">${cap}</span></a>`;
const lostRow = (S, T) => `<div style="background: ${T.card}; border-radius: 20px; flex-shrink: 0">${row(T, { icon: 'warn', tone: 'amber', title: 'O Paçoca sumiu?', sub: 'Ative o modo perdido', href: fname('modo-perdido', S, T) })}</div>`;
const petRow = (S, T, name, sub, b, hasPhoto) => `<a href="${fname('pet', S, T)}" style="display: flex; align-items: center; gap: 12px; background: ${T.card}; border-radius: 20px; padding: 14px; text-decoration: none; color: ${T.strong}">${avatar(T, 56, hasPhoto)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0"><span style="font-size: 16px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${T.muted}">${sub}</span><span>${b}</span></span>${ico('chev', 20, T.muted)}</a>`;
const pets = (S, T) => [petRow(S, T, 'Paçoca', 'Cão · vira-lata · 4 anos', badge(T, 'Tag ativa', 'ok'), true), petRow(S, T, 'Mel', 'Gata · siamesa · 2 anos', badge(T, 'Sem tag', 'neu'), false)];
const addPet = (S, T) => `<a href="${fname('novo-pet-dados', S)}" style="min-height: 84px; border-radius: 20px; border: 1.5px dashed ${T.control}; box-sizing: border-box; color: ${T.strong}; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 600">${ico('plus', 20, T.strong)}Adicionar pet</a>`;
const secHead = (T, t, link) => `<div style="display: flex; align-items: baseline; justify-content: space-between; flex-shrink: 0">${h2(T, t)}${link ? textLink(T, link[0], link[1]) : ''}</div>`;
const grid = (cols, g, inner, extra = '') => `<div style="display: grid; grid-template-columns: ${typeof cols === 'number' ? `repeat(${cols}, minmax(0, 1fr))` : cols}; gap: ${g}px; flex-shrink: 0; ${extra}">${inner}</div>`;
const col = (g, inner) => `<div style="display: flex; flex-direction: column; gap: ${g}px; min-width: 0">${inner}</div>`;
const bell = (T) => iconBtn(T, 'bell', 'Notificações, 1 nova', { dot: true });
const me = (T) => `<span style="width: 44px; height: 44px; border-radius: 999px; background: ${T.selBg}; color: ${T.selFg}; display: flex; align-items: center; justify-content: center; ${FD}; font-size: 18px; font-weight: 600; flex-shrink: 0">A</span>`;
const scanRow = (T, when, what) => `<div style="display: flex; align-items: center; gap: 12px; min-height: 52px">${tile40(T, 'scan')}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600; color: ${T.strong}">${when}</span><span style="font-size: 13px; color: ${T.muted}">${what}</span></span>${ico('chev', 20, T.muted)}</div>`;
const tiles2 = (S, T, size) => tile(T, 'Scans este mês', '3', 'O último foi hoje', fname('scans', S, T), size) + tile(T, 'Estranhos veem', '5 de 7', 'Dados do Paçoca', fname('visibilidade', S, T), size);

// ----- Painel -----
const painel = (S, T, h) => {
  const tag = 'Tag ativa · 7K3M-Q9XA-C';
  const petHref = fname('pet', S, T);
  if (S.k === 'm') {
    return app(S, T, { title: 'Painel do tutor', h, hub: true, active: 'Início',
      hubHeader: `<div style="padding: 16px 20px 0; display: flex; align-items: center; gap: 12px; flex-shrink: 0">${me(T)}<div style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-size: 13px; color: ${T.muted}">Boa tarde</span><span style="${FD}; font-size: 19px; font-weight: 600">Ana</span></div>${bell(T)}</div>`,
      body: `${hero(T, 236, 36, 24, tag, petHref)}${limeCard(S, T, 18, 22, 14)}${grid(2, 12, tiles2(S, T))}${lostRow(S, T)}` });
  }
  if (S.k === 't') {
    return app(S, T, { title: 'Painel do tutor', h, hub: true, active: 'Início',
      hubHeader: `<div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0">${me(T)}<div style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-size: 13px; color: ${T.muted}">Boa tarde</span><span style="${FD}; font-size: 24px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Ana</span></div>${bell(T)}</div>`,
      body: `${hero(T, 320, 48, 28, tag, petHref)}${grid(2, 16, limeCard(S, T, 22, 26, 15) + col(16, tiles2(S, T)))}${lostRow(S, T)}${secHead(T, 'Seus pets')}${grid(2, 16, pets(S, T).join(''))}` });
  }
  return app(S, T, { title: 'Painel do tutor', h, hub: true, active: 'Início',
    hubHeader: `<div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0"><h1 style="margin: 0; ${FD}; font-size: 36px; line-height: 1.1; font-weight: 700; letter-spacing: -0.03em">Boa tarde, Ana</h1>${bell(T)}</div>`,
    body: `${grid('440px minmax(0, 1fr)', 20, col(20, hero(T, 400, 56, 28, tag, petHref) + lostRow(S, T)) + col(20, `${limeCard(S, T, 26, 30, 16)}${grid(3, 20, tiles2(S, T) + tile(T, 'Tag vinculada há', '19 dias', 'Desde 02 nov', fname('tag', S, T)))}
<div style="background: ${T.card}; border-radius: 20px; padding: 18px 20px 12px; display: flex; flex-direction: column; gap: 6px">${secHead(T, 'Últimos scans', ['Ver todos', fname('scans', S, T)])}${scanRow(T, 'Hoje, 14:32', 'Localização aproximada. Ninguém entrou em contato.')}<div style="height: 1px; background: ${T.line}"></div>${scanRow(T, '16 nov, 09:10', 'Quem achou enviou a localização.')}</div>`))}
${secHead(T, 'Seus pets')}${grid(3, 20, pets(S, T).join('') + addPet(S, T))}` });
};

// ----- Página do pet -----
const pet = (S, T, h) => {
  const lostCard = `<div style="background: ${T.card}; border-radius: 20px; flex-shrink: 0">${row(T, { icon: 'warn', tone: 'amber', title: 'Modo perdido', sub: 'Mostra um alerta na página da tag', trail: toggle(T, false, 'Modo perdido') })}</div>`;
  const tagTile = `<a href="${fname('tag', S, T)}" style="background: ${T.card}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: ${T.strong}"><span style="font-size: 13px; color: ${T.muted}">Tag</span><span style="${FD}; font-size: 19px; font-weight: 700; letter-spacing: 0.01em">7K3M-Q9XA-C</span><span>${badge(T, 'Ativa', 'ok')}</span></a>`;
  const scanTile = `<a href="${fname('scans', S, T)}" style="background: ${T.card}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: ${T.strong}"><span style="font-size: 13px; color: ${T.muted}">Último scan</span><span style="${FD}; font-size: 19px; font-weight: 700">Hoje, 14:32</span><span style="font-size: 13px; color: ${T.muted}">Localização aproximada</span></a>`;
  const menu = group(T, [
    row(T, { icon: 'paw', title: 'Dados do pet', sub: 'Nome, foto, temperamento e cuidados', href: '#' }),
    row(T, { icon: 'eye', title: 'O que estranhos veem', sub: 'WhatsApp liberado · telefone oculto', href: fname('visibilidade', S, T) }),
    row(T, { icon: 'tag', title: 'Gerenciar tag', sub: 'Passar adiante ou pedir 2ª via', href: fname('tag', S, T) }),
    row(T, { icon: 'scan', title: 'Histórico de scans', sub: '3 scans este mês', href: fname('scans', S, T) }),
  ]);
  const traits = chipRow(tagChip(T, 'Macho') + tagChip(T, 'Castrado') + tagChip(T, 'Porte médio'));
  const sub = 'Cão · SRD caramelo · nasceu em mar 2022';
  const body = pick(S,
    `${hero(T, 200, 36, 24, sub)}${traits}${lostCard}${grid(2, 12, tagTile + scanTile)}${menu}`,
    `${hero(T, 280, 48, 28, sub)}${traits}${grid(2, 16, col(16, lostCard + grid(2, 16, tagTile + scanTile)) + menu)}`,
    grid('440px minmax(0, 1fr)', 20, col(20, hero(T, 380, 56, 28, sub) + traits + lostCard) + col(20, grid(2, 20, tagTile + scanTile) + menu)));
  return app(S, T, { title: 'Paçoca', h, active: 'Pets', bar: 'back', barHref: fname('painel', S, T), action: iconBtn(T, 'edit', 'Editar pet'), body });
};

// ----- O que estranhos veem -----
const block = (T, label, rows) => col(8, sectionLabel(T, label) + group(T, rows));
const visibilidade = (S, T, h) => {
  const always = `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: ${T.muted}">${ico('lock', 16, T.muted)}Sempre</span>`;
  const t = (title, sub, on) => row(T, { title, sub, trail: toggle(T, on, title) });
  const about = block(T, 'Sobre o pet', [row(T, { title: 'Nome e foto', sub: 'Paçoca', trail: always }), t('Temperamento', 'Dócil com pessoas, medo de barulho', true), t('Cuidados', 'Toma remédio para alergia', true)]);
  const contact = block(T, 'Contato', [t('Seu primeiro nome', 'Ana', true), t('WhatsApp', 'Botão para falar com você', true), t('Telefone', '(11) 9••••-4421 · confirmado', false)]);
  const lost = block(T, 'Só no modo perdido', [t('Há quanto tempo sumiu', 'Por exemplo: perdido há 2 dias', true), t('Selo de recompensa', 'Sem valor; você combina na conversa', true), t('Recado para quem achou', 'Escrito por você ao ativar o modo perdido', true)]);
  const intro = para(T, 'Escolha o que aparece para quem escanear a tag do Paçoca.', 15, 0);
  const prev = fname('resgate-visao-dono', S);
  return app(S, T, { title: 'O que estranhos veem', h, active: 'Pets', bar: 'back', barHref: fname('pet', S, T),
    body: pick(S, `${intro}${about}${contact}${lost}`, `${intro}${about}${contact}${lost}`, `${intro}${grid(2, 20, col(20, about + contact) + col(20, lost))}`),
    footer: [grid(2, 10, btn(T, 'Pré-visualizar', { kind: 'outline', icon: 'eye', href: prev }) + btn(T, 'Salvar'))],
    footerWide: [btn(T, 'Pré-visualizar', { kind: 'outline', icon: 'eye', full: false, href: prev }), btn(T, 'Salvar', { full: false })] });
};

// ----- Histórico de scans -----
const scans = (S, T, h) => {
  const filters = chipRow(chip(T, 'Todos', true) + chip(T, 'Este mês', false) + chip(T, 'Localização precisa', false));
  const map = (mh) => `<div style="background: ${T.card}; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 12px; flex-shrink: 0">
<div role="img" aria-label="Mapa com a área aproximada do último scan" style="position: relative; height: ${mh}px; border-radius: 14px; background: ${T.inset}; display: flex; align-items: center; justify-content: center"><span style="width: ${Math.round(mh * 0.62)}px; height: ${Math.round(mh * 0.62)}px; border-radius: 999px; border: 2px dashed ${T.control}; box-sizing: border-box; display: flex; align-items: center; justify-content: center">${ico('pin', 28, T.strong)}</span><span style="position: absolute; left: 12px; bottom: 12px; height: 28px; padding: 0 10px; border-radius: 999px; background: ${T.card}; display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; color: ${T.strong}">Raio de ~3 km</span></div>
<div style="display: flex; align-items: center; gap: 12px"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="${FD}; font-size: 18px; font-weight: 600; color: ${T.strong}">Hoje, 14:32</span><span style="font-size: 13px; color: ${T.muted}">Localização aproximada, pelo provedor de internet</span></span>${badge(T, 'Último', 'neu')}</div>
</div>`;
  const r = (when, what, b) => row(T, { icon: 'pin', title: when, sub: what, trail: b, href: undefined });
  const list = `${h2(T, 'Novembro 2026', 18)}${group(T, [r('Hoje, 14:32', 'Quem escaneou não liberou o GPS', badge(T, 'Aproximada', 'neu')), r('16 nov, 09:10', 'Quem escaneou enviou a localização', badge(T, 'Precisa · ± 15 m', 'ok')), r('02 nov, 18:47', 'Quem escaneou enviou a localização', badge(T, 'Precisa · ± 30 m', 'ok'))])}${note(T, 'info', 'Os scans ficam com você. Se a tag mudar de dono, o histórico não vai junto.')}`;
  return app(S, T, { title: 'Histórico de scans', h, active: 'Scans', bar: 'back', barHref: fname('painel', S, T),
    body: pick(S, `${filters}${map(180)}${list}`, `${filters}${map(300)}${list}`, `${filters}${grid(2, 20, map(420) + col(14, list))}`) });
};

// ----- Gerenciar tag -----
const tag = (S, T, h) => {
  const codeCard = `<div style="position: relative; background: ${NAVY[700]}; border-radius: 24px; padding: ${pick(S, 20, 26, 28)}px; overflow: hidden; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0">
${focinho(pick(S, 220, 300, 300), NAVY[600], 'position: absolute; right: -60px; top: -40px')}
<span style="position: relative; ${FD}; font-size: ${pick(S, 32, 44, 44)}px; line-height: 1.05; font-weight: 700; letter-spacing: 0.01em; color: #FFFFFF">7K3M-Q9XA-C</span>
<span style="position: relative; font-size: 15px; color: ${NAVY[100]}">Vinculada ao Paçoca desde 02 nov</span>
<span style="position: relative"><span style="display: inline-flex; align-items: center; height: 26px; padding: 0 12px; border-radius: 999px; background: #84C32E; color: #13201E; font-size: 12px; font-weight: 600">Ativa</span></span>
</div>`;
  const actions = group(T, [
    row(T, { icon: 'share', title: 'Passar a tag adiante', sub: 'Gera um PIN novo para o próximo dono', href: '#' }),
    row(T, { icon: 'print', title: 'Pedir 2ª via: tag danificada', sub: 'Mesmo código, etiqueta nova', href: '#' }),
    row(T, { icon: 'warn', tone: 'amber', title: 'Pedir 2ª via: perdi a tag', sub: 'Código novo; o antigo deixa de funcionar', href: '#' }),
  ]);
  const unlink = btn(T, 'Desvincular tag do Paçoca', { kind: 'danger', h: 48, fs: 15 });
  return app(S, T, { title: 'Tag do Paçoca', h, active: 'Pets', bar: 'back', barHref: fname('pet', S, T),
    body: pick(S, `${codeCard}${actions}${unlink}`, `${codeCard}${actions}${unlink}`, grid('440px minmax(0, 1fr)', 20, col(20, codeCard) + col(12, actions + unlink))) });
};

// ----- Ativar modo perdido -----
const modoPerdido = (S, T, h) => {
  const intro = `<div>${h2(T, 'O Paçoca sumiu?', pick(S, 28, 32, 32))}${para(T, 'Ao ativar, a página da tag passa a mostrar o alerta. Você continua recebendo um aviso a cada scan.', 15, 8)}</div>`;
  const msg = field(T, 'mprecado', 'Recado para quem achar', { area: true, value: 'Ele se assusta fácil. Fale baixo, ofereça água e não corra atrás. Me chame que eu vou até aí.' });
  const opts = group(T, [
    row(T, { title: 'Mostrar há quanto tempo sumiu', sub: 'Contado a partir de agora', trail: toggle(T, true, 'Mostrar há quanto tempo sumiu') }),
    row(T, { title: 'Avisar que há recompensa', sub: 'Sem valor; você combina na conversa', trail: toggle(T, true, 'Avisar que há recompensa') }),
  ]);
  const preview = `<div style="display: flex; flex-direction: column; gap: 8px">${sectionLabel(T, 'Como vai aparecer')}<div style="background: #A85A0E; border-radius: 24px; padding: 22px; display: flex; flex-direction: column">
<span style="${FD}; font-size: 30px; line-height: 1.04; font-weight: 700; letter-spacing: -0.03em; color: #FFFFFF">Sou o Paçoca.<br>Estou perdido.</span>
<div style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px"><span style="display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: #8A4A0C; font-size: 13px; font-weight: 600">${ico('clock', 16, '#8A4A0C')}Perdido há poucos minutos</span><span style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: #8A4A0C; font-size: 13px; font-weight: 600">Há recompensa</span></div>
</div></div>`;
  const back = fname('pet', S, T);
  return app(S, T, { title: 'Modo perdido', h, active: 'Pets', bar: 'close', barHref: back,
    body: pick(S, `${intro}${msg}${opts}`, `${intro}${grid(2, 16, col(16, msg + opts) + preview)}`, `${intro}${grid(2, 20, col(20, msg + opts) + preview)}`),
    footer: [btn(T, 'Ativar modo perdido', { fs: 18 }), btn(T, 'Agora não', { kind: 'ghost', h: 44, fs: 15, href: back })],
    footerWide: [btn(T, 'Agora não', { kind: 'ghost', full: false, href: back }), btn(T, 'Ativar modo perdido', { full: false })] });
};

module.exports = [
  { base: 'painel', name: 'Painel do tutor', group: 'app', dark: true, H: { m: 844, t: 1024, d: 900 }, fn: painel },
  { base: 'pet', name: 'Página do pet', group: 'app', dark: true, H: { m: 880, t: 1024, d: 900 }, fn: pet },
  { base: 'visibilidade', name: 'O que estranhos veem', group: 'app', dark: true, H: { m: 1000, t: 1060, d: 900 }, fn: visibilidade },
  { base: 'scans', name: 'Histórico de scans', group: 'app', dark: true, H: { m: 844, t: 1024, d: 900 }, fn: scans },
  { base: 'tag', name: 'Gerenciar tag', group: 'app', dark: true, H: { m: 844, t: 1024, d: 900 }, fn: tag },
  { base: 'modo-perdido', name: 'Ativar modo perdido', group: 'app', dark: true, H: { m: 844, t: 1024, d: 900 }, fn: modoPerdido },
];
