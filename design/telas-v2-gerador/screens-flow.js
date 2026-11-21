// Conta, ativação da tag e cadastro de pet (sempre no tema claro).
const { FD, FB, NAVY, L: T, LOGO, pick, fname, ico, focinho, GOOGLE, page, grow, gap, h1, para, btn, iconBtn, textLink, chip, chipRow, segmented, card, field, eyeBtn, checkbox, cells, avatar, radioCard, note, photo, logoImg, mark, brandPanel, flow, tile40 } = require('./lib');

const to = (b, S) => fname(b, S, T);
const head = (S, t, p) => `<div>${h1(T, t, pick(S, 32, 42, 42))}${p ? para(T, p, 16, 10) : ''}</div>`;
const small = (html) => `<p style="margin: 0; font-size: 14px; color: ${T.text}; text-align: center">${html}</p>`;
const orLine = () => `<div style="display: flex; align-items: center; gap: 10px"><span style="flex-grow: 1; height: 1px; background: ${T.border}"></span><span style="font-size: 13px; color: ${T.muted}">ou</span><span style="flex-grow: 1; height: 1px; background: ${T.border}"></span></div>`;
const stack = (items, g = 14) => `<div style="display: flex; flex-direction: column; gap: ${g}px">${items.join('')}</div>`;
const SIDE = ['O caminho<br>de volta<br>para casa.', 'A tag com QR Code que ajuda quem achou o seu pet a falar com você.'];
const summary = (S, sub, back) => `<div style="background: ${T.card}; border-radius: 20px; padding: 12px 14px; display: flex; align-items: center; gap: 12px">${avatar(T, 48)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">Paçoca</span><span style="font-size: 13px; color: ${T.muted}">${sub}</span></span>${textLink(T, 'Trocar', to(back, S))}</div>`;
const lockNote = () => note(T, 'lock', 'Por segurança, a tag é travada por alguns minutos depois de várias tentativas erradas.');
const support = () => small(`Perdeu o cartão? ${textLink(T, 'Fale com o suporte')}`);
const codeChip = () => `<div style="display: flex"><span style="display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 16px; border-radius: 999px; background: ${T.card}; ${FD}; font-size: 16px; font-weight: 600; letter-spacing: 0.02em">${ico('qr', 18, T.strong)}7K3M-Q9XA-C${ico('check', 18, T.okFg)}</span></div>`;

// ----- Boas-vindas -----
const welcome = (S, h) => {
  const copy = (hs) => `${h1(T, 'O caminho de volta para casa.', hs)}${para(T, 'Uma tag com QR na coleira. Quem encontrar o seu pet fala com você na hora, sem precisar de app.', pick(S, 16, 18, 18), 12)}`;
  const acts = `${btn(T, 'Criar conta', { href: to('criar-conta', S) })}${gap(10)}${btn(T, 'Já tenho conta', { kind: 'outline', href: to('entrar', S) })}`;
  if (S.k === 'm') {
    return page('Boas-vindas · celular', S.w, h, T, 'flex-direction: column', `<div style="position: relative; height: 470px; flex-shrink: 0; background: ${T.photoBg}">${photo('center 30%')}${mark(16)}</div>
<div style="position: relative; margin-top: -28px; flex-grow: 1; background: ${T.bg}; border-radius: 28px 28px 0 0; padding: 26px 20px 22px; display: flex; flex-direction: column">${copy(38)}${grow(16)}${acts}</div>`);
  }
  if (S.k === 't') {
    return page('Boas-vindas · tablet', S.w, h, T, 'flex-direction: column', `<div style="position: relative; height: 560px; flex-shrink: 0; background: ${T.photoBg}">${photo('center 32%')}${mark(24, 52)}</div>
<div style="position: relative; margin-top: -32px; flex-grow: 1; background: ${T.bg}; border-radius: 32px 32px 0 0; padding: 44px 0 40px; display: flex; flex-direction: column; align-items: center"><div style="width: 560px; flex-grow: 1; display: flex; flex-direction: column">${copy(56)}${grow(24)}${acts}</div></div>`);
  }
  return page('Boas-vindas · desktop', S.w, h, T, 'flex-direction: row', `<div style="position: relative; width: 720px; flex-shrink: 0; background: ${T.photoBg}">${photo('center 30%')}</div>
<div style="width: 720px; flex-shrink: 0; box-sizing: border-box; padding: 48px 120px; display: flex; flex-direction: column; justify-content: center">${logoImg(LOGO, 64, 'margin-bottom: 36px')}${copy(64)}${gap(32)}${acts}</div>`);
};

// ----- Entrar -----
const loginForm = (S, k, hs) => `${h1(T, 'Que bom<br>te ver de novo.', hs, 'line-height: 1.02')}
${para(T, 'Entre para cuidar das tags dos seus pets.', 16, 12)}
<div style="margin-top: 22px">${stack([field(T, `${k}email`, 'E-mail', { type: 'email', value: 'ana@email.com' }), field(T, `${k}senha`, 'Senha', { type: 'password', value: 'senhasegura', trail: eyeBtn(T) })])}</div>
<div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px">${checkbox(T, `${k}manter`, 'Manter conectado')}${textLink(T, 'Esqueci a senha')}</div>
${gap(12)}${btn(T, 'Entrar', { fs: 18, href: to('painel', S) })}${gap(16)}${orLine()}${gap(16)}${btn(T, 'Entrar com o Google', { kind: 'outline', icon: 'google' })}`;
const signupLine = (S) => small(`Ainda não tem conta? ${textLink(T, 'Criar conta', to('criar-conta', S))}`);
const login = (S, h) => {
  if (S.k === 'm') {
    return page('Entrar · celular', S.w, h, T, 'flex-direction: column', `${focinho(270, '#84C32E', 'position: absolute; right: -76px; top: -74px')}
<div style="position: relative; padding: 12px 16px 0; flex-shrink: 0">${iconBtn(T, 'back', 'Voltar', { href: to('boas-vindas', S) })}</div>
<div style="position: relative; flex-grow: 1; padding: 26px 20px 22px; display: flex; flex-direction: column">${logoImg(LOGO, 48, 'margin-bottom: 22px')}${loginForm(S, 'm', 40)}${grow(16)}${signupLine(S)}</div>`);
  }
  if (S.k === 't') {
    return page('Entrar · tablet', S.w, h, T, 'flex-direction: column', `${focinho(520, '#84C32E', 'position: absolute; right: -150px; top: -150px')}
<div style="position: relative; padding: 24px 24px 0; flex-shrink: 0">${iconBtn(T, 'back', 'Voltar', { href: to('boas-vindas', S) })}</div>
<div style="position: relative; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 56px"><div style="width: 440px; display: flex; flex-direction: column">${logoImg(LOGO, 60, 'margin-bottom: 28px')}${loginForm(S, 't', 52)}${gap(28)}${signupLine(S)}</div></div>`);
  }
  return page('Entrar · desktop', S.w, h, T, 'flex-direction: row', `${brandPanel(720, SIDE[0], SIDE[1], { hs: 72 })}
<div style="width: 720px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center"><div style="width: 400px; display: flex; flex-direction: column">${loginForm(S, 'd', 44)}${gap(28)}${signupLine(S)}</div></div>`);
};

const speciesCard = (label, icon, sel) => `<button aria-pressed="${sel}" style="height: 96px; border-radius: 20px; background: ${T.card}; border: 2px solid ${sel ? T.strong : 'transparent'}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; ${FB}; font-size: 15px; font-weight: 600; color: ${T.strong}">${tile40(T, icon)}${label}</button>`;
const label = (t) => `<span style="font-size: 14px; font-weight: 600; color: ${T.strong}">${t}</span>`;

module.exports = [
  { base: 'boas-vindas', name: 'Boas-vindas', group: 'conta', H: { m: 844, t: 1024, d: 900 }, fn: (S, T_, h) => welcome(S, h) },
  { base: 'entrar', name: 'Entrar', group: 'conta', H: { m: 844, t: 1024, d: 900 }, fn: (S, T_, h) => login(S, h) },
  {
    base: 'criar-conta', name: 'Criar conta', group: 'conta', H: { m: 960, t: 1100, d: 960 },
    fn: (S, T_, h) => flow(S, {
      title: 'Criar conta', h, bar: 'back', barHref: to('boas-vindas', S), side: ['Só o<br>necessário.', 'Nome, e-mail e celular. Nada de CPF ou endereço para ativar a sua tag.'],
      body: `${head(S, 'Crie sua conta', 'Só o necessário para quem encontrar seu pet falar com você.')}
${stack([field(T, 'ccnome', 'Nome', { value: 'Ana Souza' }), field(T, 'ccemail', 'E-mail', { type: 'email', value: 'ana@email.com' }), field(T, 'cccel', 'Celular', { type: 'tel', value: '(11) 98765-4421', help: 'Vamos confirmar este número por SMS.' }), field(T, 'ccsenha', 'Senha', { type: 'password', ph: 'Pelo menos 8 caracteres', trail: eyeBtn(T) })])}
${checkbox(T, 'cctermos', `Li e aceito os ${textLink(T, 'Termos')} e a ${textLink(T, 'Política de privacidade')}.`)}`,
      footer: [btn(T, 'Criar conta', { fs: 18, href: to('confirmar-celular', S) }), `<div style="width: 100%">${orLine()}</div>`, btn(T, 'Continuar com o Google', { kind: 'outline', icon: 'google' }), small(`Já tem conta? ${textLink(T, 'Entrar', to('entrar', S))}`)],
    }),
  },
  {
    base: 'confirmar-celular', name: 'Confirmar celular', group: 'conta', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Confirmar celular', h, bar: 'back', barHref: to('criar-conta', S), side: ['Um número<br>que atende.', 'É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes.'],
      body: `${head(S, 'Confirme seu celular', 'Enviamos um código de 6 dígitos por SMS para (11) 98765-4421. É esse número que aparece para quem encontrar seu pet.')}
${cells(T, ['4', '8', '2', '9'], 4, 'Dígito')}
<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${T.muted}">${ico('clock', 18, T.muted)}Reenviar em 0:42</div>
${S.k === 'm' ? grow(8) : ''}`,
      footer: [btn(T, 'Confirmar', { fs: 18, disabled: true }), small(`Número errado? ${textLink(T, 'Corrigir', to('criar-conta', S))}`)],
    }),
  },
  {
    base: 'ativacao-pet', name: 'Ativação · escolher o pet', group: 'ativ', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Ativação: escolher o pet', h, bar: 'close', barTitle: 'Ativar tag', step: [1, 2], side: ['Uma tag,<br>um pet.', 'Você escolhe para quem é a tag e confirma com o PIN do cartão.'],
      body: `${codeChip()}
${head(S, 'Para qual pet é esta tag?', 'Cada pet tem uma tag ativa por vez.')}
<div role="radiogroup" aria-label="Pet" style="display: flex; flex-direction: column; gap: 10px">${radioCard(T, { title: 'Paçoca', sub: 'Cão · sem tag', sel: true, photo: true })}${radioCard(T, { title: 'Mel', sub: 'Gata · sem tag' })}</div>
${btn(T, 'Cadastrar um pet novo', { kind: 'dashed', icon: 'plus', href: to('novo-pet-dados', S) })}
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Continuar', { fs: 18, href: to('ativacao-pin', S) })],
    }),
  },
  {
    base: 'ativacao-pin', name: 'Ativação · PIN', group: 'ativ', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Ativação: PIN', h, bar: 'back', barHref: to('ativacao-pet', S), barTitle: 'Ativar tag', step: [2, 2], side: ['O PIN prova<br>que a tag<br>é sua.', 'Ele vem no cartão dentro da embalagem e nunca na etiqueta.'],
      body: `${head(S, 'Agora, o PIN do cartão', 'São 6 caracteres impressos no cartão que veio com a tag. O PIN vale uma vez só.')}
${cells(T, ['K', '4', '7', 'Q', '9', 'M'], -1, 'Caractere do PIN')}
${summary(S, 'Tag 7K3M-Q9XA-C · lida pelo QR', 'ativacao-pet')}
${lockNote()}
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Ativar tag', { fs: 18, href: to('ativacao-sucesso', S) }), support()],
    }),
  },
  {
    base: 'ativacao-sucesso', name: 'Tag ativa', group: 'ativ', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Tag ativa', h, side: ['Pronto.<br>O Paçoca<br>tem como<br>voltar.', 'A partir de agora, quem escanear a tag fala direto com você.'],
      body: `<div style="position: relative; background: ${NAVY[700]}; border-radius: 24px; padding: 22px; overflow: hidden; display: flex; flex-direction: column; gap: 10px">
${focinho(220, NAVY[600], 'position: absolute; right: -60px; top: -40px')}
<span style="position: relative; width: 48px; height: 48px; border-radius: 999px; background: #84C32E; display: flex; align-items: center; justify-content: center">${ico('check', 26, T.strong)}</span>
<span style="position: relative; ${FD}; font-size: ${pick(S, 36, 44, 44)}px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; color: #FFFFFF">Tag ativa!</span>
<span style="position: relative; max-width: 300px; font-size: 15px; line-height: 1.45; color: ${NAVY[100]}">A tag 7K3M-Q9XA-C agora leva quem encontrar o Paçoca até você.</span>
</div>
${card(T, ['WhatsApp liberado para quem escanear', 'Celular confirmado', 'Você recebe um aviso a cada scan'].map((t) => `<div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: ${T.strong}">${ico('check', 20, T.okFg)}${t}</div>`).join(''), '16px', 'gap: 12px')}
<div style="background: ${T.card}; border-radius: 20px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px">${tile40(T, 'scan')}<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">Faça um teste</span><span style="font-size: 14px; line-height: 1.45; color: ${T.text}">Escaneie a tag de novo para ver o que aparece para quem encontrar o Paçoca. Esse scan não dispara aviso.</span></div></div>
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Ver a página do Paçoca', { fs: 18, icon: 'eye', href: to('resgate-visao-dono', S) }), btn(T, 'Ir para o painel', { kind: 'ghost', h: 44, fs: 15, href: to('painel', S) })],
    }),
  },
  {
    base: 'vincular-codigo', name: 'Vincular tag · código', group: 'ativ', H: { m: 880, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Vincular tag: código', h, bar: 'close', barHref: to('pet', S), barTitle: 'Vincular tag', step: [1, 2], side: ['Uma tag,<br>um pet.', 'Escaneie o QR ou digite o código impresso embaixo dele.'],
      body: `${head(S, 'Qual tag você vai usar?', 'O código fica impresso embaixo do QR, na própria tag.')}
${segmented(T, ['Escanear QR', 'Digitar código'], 1, 'Como informar a tag')}
${field(T, 'vccodigo', 'Código da tag', { value: '7K3M-Q9XA-C', ok: 'Código válido · tag disponível' })}
<div style="display: flex; flex-direction: column; gap: 10px">${label('Para qual pet?')}<div role="radiogroup" aria-label="Pet" style="display: flex; flex-direction: column; gap: 10px">${radioCard(T, { title: 'Paçoca', sub: 'Cão · sem tag', sel: true, photo: true })}${radioCard(T, { title: 'Mel', sub: 'Gata · sem tag' })}</div></div>
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Continuar', { fs: 18, href: to('vincular-pin', S) })],
    }),
  },
  {
    base: 'vincular-pin', name: 'Vincular tag · PIN', group: 'ativ', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Vincular tag: PIN', h, bar: 'back', barHref: to('vincular-codigo', S), barTitle: 'Vincular tag', step: [2, 2], side: ['O PIN prova<br>que a tag<br>é sua.', 'Ele vem no cartão dentro da embalagem e nunca na etiqueta.'],
      body: `${head(S, 'Digite o PIN do cartão', 'São 6 caracteres e vêm no cartão dentro da embalagem. O PIN vale uma vez só.')}
${cells(T, ['K', '4', '7'], 3, 'Caractere do PIN')}
${summary(S, 'Tag 7K3M-Q9XA-C', 'vincular-codigo')}
${lockNote()}
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Ativar tag', { fs: 18, disabled: true }), support()],
    }),
  },
  {
    base: 'novo-pet-dados', name: 'Novo pet · dados', group: 'ativ', H: { m: 920, t: 1060, d: 940 },
    fn: (S, T_, h) => flow(S, {
      title: 'Novo pet: dados', h, bar: 'close', barHref: to('painel', S), barTitle: 'Novo pet', step: [1, 2], side: ['Quem é<br>o seu pet?', 'O básico para quem achar saber com quem está falando.'],
      body: `${head(S, 'Conte sobre seu pet')}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">${speciesCard('Cão', 'paw', true)}${speciesCard('Gato', 'paw', false)}</div>
${field(T, 'npnome', 'Nome', { value: 'Paçoca' })}
${field(T, 'npraca', 'Raça', { value: 'SRD (sem raça definida)' })}
<div style="display: flex; flex-direction: column; gap: 8px">${label('Sexo')}${segmented(T, ['Macho', 'Fêmea'], 0, 'Sexo')}</div>
<div style="display: flex; flex-direction: column; gap: 8px">${label('Porte')}${chipRow(chip(T, 'Pequeno', false) + chip(T, 'Médio', true) + chip(T, 'Grande', false))}</div>`,
      footer: [btn(T, 'Continuar', { fs: 18, href: to('novo-pet-resgate', S) })],
    }),
  },
  {
    base: 'novo-pet-resgate', name: 'Novo pet · foto e cuidados', group: 'ativ', H: { m: 844, t: 1024, d: 900 },
    fn: (S, T_, h) => flow(S, {
      title: 'Novo pet: foto e cuidados', h, bar: 'back', barHref: to('novo-pet-dados', S), barTitle: 'Novo pet', step: [2, 2], side: ['O que ajuda<br>num resgate.', 'Uma foto clara e duas linhas sobre o jeito dele fazem diferença para quem achou.'],
      body: `${head(S, 'O que ajuda num resgate', 'Isso aparece para quem encontrar o Paçoca. Você escolhe o que mostrar depois.')}
<div style="display: flex; align-items: center; gap: 14px">${avatar(T, 88)}<div style="flex-grow: 1">${btn(T, 'Trocar foto', { kind: 'ink', icon: 'camera', h: 52, fs: 16 })}</div></div>
<div style="display: flex; flex-direction: column; gap: 8px">${label('Temperamento')}${chipRow(chip(T, 'Dócil com pessoas', true) + chip(T, 'Medo de barulho', true) + chip(T, 'Não gosta de gatos', false) + chip(T, 'Foge fácil', false) + chip(T, '+ Outro', false))}</div>
${field(T, 'npcuid', 'Cuidados importantes', { area: true, value: 'Toma remédio para alergia. Não ofereça comida, só água.' })}
${S.k === 'm' ? grow(4) : ''}`,
      footer: [btn(T, 'Salvar pet', { fs: 18, href: to('pet', S) }), btn(T, 'Pular por enquanto', { kind: 'ghost', h: 44, fs: 15, href: to('pet', S) })],
    }),
  },
];
