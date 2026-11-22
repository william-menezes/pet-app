// Páginas públicas da tag (sempre no tema claro).
const { FD, FB, NAVY, L: T, pick, fname, ico, focinho, page, grow, gap, h1, para, btn, textLink, tagChip, chipRow, infoCard, photo, mark, brandPanel, tile40 } = require('./lib');

const INK = T.strong;
const cta = (h, fs, disabled) => btn(T, 'Avisar a Ana no WhatsApp', { icon: 'whats', h, fs, disabled });
const loc = (disabled) => `<button${disabled ? ' disabled' : ''} style="margin-top: 2px; height: 44px; width: 100%; border: none; background: transparent; color: ${disabled ? T.muted : INK}; display: flex; align-items: center; justify-content: center; gap: 8px; ${FB}; font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px">${ico('pin', 18, disabled ? T.muted : INK)}<span>Enviar onde estou para a Ana</span></button>`;
const foot = (pad, fw = 250, right = -78) => `<div style="position: relative; flex-shrink: 0; background: ${NAVY[700]}; padding: ${pad}; overflow: hidden; display: flex; flex-direction: column; gap: 6px">
${focinho(fw, NAVY[600], `position: absolute; right: ${right}px; top: -34px`)}
<span style="position: relative; ${FD}; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF">O caminho de volta para casa.</span>
<span style="position: relative; max-width: 300px; font-size: 13px; line-height: 1.4; color: ${NAVY[100]}">Faro é a tag de identificação do Paçoca. A conversa é direto entre você e a Ana.</span>
<span style="position: relative; ${FD}; font-size: 13px; font-weight: 600; color: #84C32E">Tag 7K3M-Q9XA-C</span>
</div>`;
const hello = (s, p) => `${h1(T, 'Oi, eu sou<br>o Paçoca.', s, 'line-height: 1')}
${para(T, 'Se você me achou sozinho, avise a Ana. Ela me leva de volta para casa.', p, Math.round(s / 4), 'max-width: 480px')}`;
const chips = (mt = 14) => chipRow(tagChip(T, 'Dócil com pessoas') + tagChip(T, 'Medo de barulho'), mt);
const care = (mt = 14) => `<div style="margin-top: ${mt}px; background: #FFFFFF; border-radius: 16px; padding: 12px 14px; display: flex; align-items: center; gap: 12px">${tile40(T, 'warn')}<p style="margin: 0; font-size: 15px; line-height: 1.4; color: ${INK}">Tomo remédio para alergia. Não me dê comida, só água.</p></div>`;
const lostHead = (s, p) => `<h1 style="margin: 0; ${FD}; font-size: ${s}px; line-height: 1.02; font-weight: 700; letter-spacing: -0.03em; color: #FFFFFF">Sou o Paçoca.<br>Estou perdido.</h1>
<p style="margin: ${Math.round(s / 4)}px 0 0; max-width: 480px; font-size: ${p}px; line-height: 1.45; color: #FFFFFF">Minha família está me procurando. Você me ajuda a voltar para casa?</p>
<div style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px"><span style="display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: ${T.amberFg}; font-size: 13px; font-weight: 600">${ico('clock', 16, T.amberFg)}Perdido há 2 dias</span><span style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: ${T.amberFg}; font-size: 13px; font-weight: 600">Há recompensa</span></div>`;
const recado = () => `<div style="background: #FFFFFF; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 600; color: ${T.muted}">Recado da Ana, minha tutora</span><p style="margin: 0; font-size: 15px; line-height: 1.45; color: ${INK}">Ele se assusta fácil. Fale baixo, ofereça água e não corra atrás. Me chame que eu vou até aí.</p></div>`;
const pic = (style, pos, m, ms) => `<div style="position: relative; ${style}; flex-shrink: 0; background: ${T.photoBg}">${photo(pos)}${mark(m, ms)}</div>`;
const ownerBar = (S) => `<div style="background: ${NAVY[700]}; padding: ${pick(S, '12px 16px', '14px 28px', '14px 32px')}; display: flex; align-items: center; gap: 12px; flex-shrink: 0">${ico('eye', 22, '#FFFFFF')}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1px"><span style="color: #FFFFFF; font-size: 15px; font-weight: 600">Você está vendo como um estranho</span><span style="color: ${NAVY[100]}; font-size: 13px">Este scan não gera aviso</span></div><a href="${fname('visibilidade', S, T)}" style="height: 40px; padding: 0 18px; border-radius: 999px; background: #84C32E; color: ${INK}; display: inline-flex; align-items: center; text-decoration: none; ${FD}; font-size: 15px; font-weight: 600">Editar</a></div>`;
const ownerNote = () => `<p style="margin: 6px 0 0; font-size: 13px; line-height: 1.4; color: ${T.muted}; text-align: center">Os botões ficam desativados na sua visão, para você não mandar mensagem para si mesma.</p>`;

// Resgate normal e visão do dono
const rescue = (S, h, own) => {
  const top = own ? ownerBar(S) : '';
  const acts = (bh, fs) => `${cta(bh, fs, own)}${loc(own)}${own ? ownerNote() : ''}`;
  const name = own ? 'Página de resgate · visão do dono' : 'Página de resgate';
  if (S.k === 'm') {
    return page(name + ' · celular', S.w, h, T, 'flex-direction: column', `${top}${pic(`height: ${own ? 250 : 300}px`, 'center 28%', 16)}
<div style="position: relative; margin-top: -28px; flex-grow: 1; background: ${T.bg}; border-radius: 28px 28px 0 0; padding: 24px 20px 14px; display: flex; flex-direction: column">
${hello(46, 17)}${chips()}${care()}${grow()}${acts(60, 18)}
</div>
${foot('16px 20px 18px')}`);
  }
  if (S.k === 't') {
    return page(name + ' · tablet', S.w, h, T, 'flex-direction: column', `${top}${pic(`height: ${own ? 350 : 410}px`, 'center 32%', 24, 52)}
<div style="position: relative; margin-top: -32px; flex-grow: 1; background: ${T.bg}; border-radius: 32px 32px 0 0; padding: 40px 0 20px; display: flex; flex-direction: column; align-items: center">
<div style="width: 560px; flex-grow: 1; display: flex; flex-direction: column">
${hello(64, 19)}${chips(18)}${care(16)}${grow(16)}${acts(64, 20)}
</div>
</div>
${foot('20px 104px 22px', 300, -60)}`);
  }
  return page(name + ' · desktop', S.w, h, T, 'flex-direction: column', `${top}<div style="flex-grow: 1; display: flex; flex-direction: row">
${pic('width: 720px', 'center 30%', 32, 56)}
<div style="width: 720px; flex-shrink: 0; display: flex; flex-direction: column">
<div style="flex-grow: 1; padding: 32px 96px; display: flex; flex-direction: column; justify-content: center">
${hello(72, 20)}${chips(20)}${care(16)}${gap(28)}${acts(64, 20)}
</div>
${foot('22px 96px 24px', 300, -60)}
</div>
</div>`);
};

const lost = (S, h) => {
  if (S.k === 'm') {
    return page('Resgate em modo perdido · celular', S.w, h, T, 'flex-direction: column', `${pic('height: 236px', 'center 24%', 16)}
<div style="position: relative; margin-top: -28px; flex-shrink: 0; background: ${T.lost}; border-radius: 28px 28px 0 0; padding: 22px 20px 20px; display: flex; flex-direction: column">
${lostHead(40, 16)}
</div>
<div style="flex-grow: 1; padding: 16px 20px 14px; display: flex; flex-direction: column">
${recado()}${grow()}${cta(60, 18)}${loc()}
</div>
${foot('16px 20px 18px')}`);
  }
  if (S.k === 't') {
    return page('Resgate em modo perdido · tablet', S.w, h, T, 'flex-direction: column', `${pic('height: 360px', 'center 30%', 24, 52)}
<div style="position: relative; margin-top: -32px; flex-shrink: 0; background: ${T.lost}; border-radius: 32px 32px 0 0; padding: 36px 0 32px; display: flex; flex-direction: column; align-items: center">
<div style="width: 560px; display: flex; flex-direction: column">${lostHead(56, 18)}</div>
</div>
<div style="flex-grow: 1; padding: 24px 0 20px; display: flex; flex-direction: column; align-items: center">
<div style="width: 560px; flex-grow: 1; display: flex; flex-direction: column">
${recado()}${grow(16)}${cta(64, 20)}${loc()}
</div>
</div>
${foot('20px 104px 22px', 300, -60)}`);
  }
  return page('Resgate em modo perdido · desktop', S.w, h, T, 'flex-direction: row', `${pic('width: 720px', 'center 30%', 32, 56)}
<div style="width: 720px; flex-shrink: 0; display: flex; flex-direction: column">
<div style="flex-shrink: 0; background: ${T.lost}; padding: 88px 96px 44px; display: flex; flex-direction: column">${lostHead(64, 19)}</div>
<div style="flex-grow: 1; padding: 32px 96px 24px; display: flex; flex-direction: column">
${recado()}${gap(24)}${cta(64, 20)}${loc()}
</div>
${foot('22px 96px 24px', 300, -60)}
</div>`);
};

// Páginas públicas sem foto: tag não ativada e código não encontrado.
const info = (S, h, o) => {
  const body = (hs) => `${h1(T, o.h1, hs)}
${para(T, o.p, pick(S, 16, 18, 18), 14)}
${o.code ? `<div style="margin-top: 16px; display: flex"><span style="display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 999px; background: #FFFFFF; ${FD}; font-size: 16px; font-weight: 600; letter-spacing: 0.02em; color: ${INK}">${ico('qr', 18, INK)}${o.code}</span></div>` : ''}
${gap(18)}
${infoCard(T, 'info', o.info[0], o.info[1])}`;
  const acts = `<div style="display: flex; flex-direction: column; align-items: center; gap: 12px">${o.actions(S)}</div>`;
  if (S.k === 'm') {
    return page(o.title + ' · celular', S.w, h, T, 'flex-direction: column', `${brandPanel(0, null, null, { h: 230, pad: '20px', fw: 300, fr: -70, ft: -40, logoH: 52 })}
<div style="position: relative; margin-top: -28px; flex-grow: 1; background: ${T.bg}; border-radius: 28px 28px 0 0; padding: 28px 20px 22px; display: flex; flex-direction: column">
${body(38)}${grow(18)}${acts}
</div>`);
  }
  if (S.k === 't') {
    return page(o.title + ' · tablet', S.w, h, T, 'flex-direction: column', `${brandPanel(0, null, null, { h: 330, pad: '28px 32px', fw: 480, fr: -110, ft: -80, logoH: 60 })}
<div style="position: relative; margin-top: -32px; flex-grow: 1; background: ${T.bg}; border-radius: 32px 32px 0 0; padding: 44px 0 40px; display: flex; flex-direction: column; align-items: center">
<div style="width: 560px; flex-grow: 1; display: flex; flex-direction: column">
${body(56)}${grow(24)}${acts}
</div>
</div>`);
  }
  return page(o.title + ' · desktop', S.w, h, T, 'flex-direction: row', `${brandPanel(720, 'O caminho<br>de volta<br>para casa.', 'A tag com QR Code que ajuda quem achou o seu pet a falar com você.', { hs: 72 })}
<div style="width: 720px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 104px; box-sizing: border-box">
${body(60)}${gap(28)}${acts}
</div>`);
};

module.exports = [
  { base: 'resgate', name: 'Página de resgate', group: 'pub', H: { m: 844, t: 1024, d: 900 }, fn: (S, T_, h) => rescue(S, h, false) },
  { base: 'resgate-perdido', name: 'Resgate em modo perdido', group: 'pub', H: { m: 844, t: 1024, d: 900 }, fn: (S, T_, h) => lost(S, h) },
  { base: 'resgate-visao-dono', name: 'Resgate · visão do dono', group: 'pub', H: { m: 900, t: 1060, d: 900 }, fn: (S, T_, h) => rescue(S, h, true) },
  {
    base: 'tag-nao-ativada', name: 'Tag não ativada', group: 'pub', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => info(S, h, {
      title: 'Tag não ativada', h1: 'Esta tag ainda não foi ativada.', p: 'Se a tag é sua, ative em poucos minutos com o PIN que veio no cartão da embalagem.', code: '7K3M-Q9XA-C',
      info: ['Encontrou um pet com esta tag?', 'Ela ainda não tem família cadastrada. Uma clínica veterinária ou ONG pode ler o microchip do animal.'],
      actions: (S2) => `${btn(T, 'Ativar minha tag', { h: 60, fs: 18, href: fname('criar-conta', S2, T) })}<p style="margin: 0; font-size: 14px; color: ${T.text}">Já tem conta? ${textLink(T, 'Entrar', fname('entrar', S2, T))}</p>`,
    }),
  },
  {
    base: 'tag-nao-encontrada', name: 'Tag não encontrada', group: 'pub', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => info(S, h, {
      title: 'Tag não encontrada', h1: 'Não encontramos esta tag.', p: 'O endereço pode ter sido digitado errado, ou esta tag não está mais em uso.',
      info: ['Encontrou um pet?', 'Uma clínica veterinária ou ONG pode ler o microchip do animal e localizar a família.'],
      actions: () => btn(T, 'Conhecer o Faro', { kind: 'outline', h: 56, href: '#' }),
    }),
  },
];
