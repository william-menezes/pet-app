// Telas que faltavam (desenhadas em 2026-11-21, a pedido do William): conta e acesso (spec 004),
// "Seus pets" (spec 003) e a página de Termos. Fila e Auditoria do admin estão em screens-admin.js.
const { FD, FB, NAVY, L, D, LOGO, pick, fname, ico, focinho, GOOGLE, page, grow, gap, h1, h2, para, btn, textLink, badge, segmented, tile40, row, group, sectionLabel, field, eyeBtn, checkbox, cells, avatar, note, logoImg, flow, app } = require('./lib');

// ============================================================ fluxos (sempre claros)
const T = L;
const to = (b, S) => fname(b, S, T);
const head = (S, t, p) => `<div>${h1(T, t, pick(S, 32, 42, 42))}${p ? para(T, p, 16, 10) : ''}</div>`;
const small = (html) => `<p style="margin: 0; font-size: 14px; color: ${T.text}; text-align: center">${html}</p>`;
const bigIcon = (X, icon, tone) => `<span style="width: 56px; height: 56px; border-radius: 999px; background: ${tone ? X[tone + 'Bg'] : X.card}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">${ico(icon, 26, tone ? X[tone + 'Fg'] : X.strong)}</span>`;
const alertBox = (X, tone, icon, html) => `<div role="status" style="background: ${X[tone + 'Bg']}; color: ${X[tone + 'Fg']}; border-radius: 16px; padding: 12px 14px; display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.45; font-weight: 600; flex-shrink: 0">${ico(icon, 20, X[tone + 'Fg'])}<span>${html}</span></div>`;
const wait = (t) => `<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${T.muted}">${ico('clock', 18, T.muted)}${t}</div>`;
const cellsErr = () => `<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; max-width: 368px">${Array.from({ length: 6 }, (_, i) => `<input aria-label="Dígito ${i + 1}" aria-invalid="true" maxlength="1" inputmode="numeric" style="height: 60px; width: 100%; box-sizing: border-box; border-radius: 12px; border: ${i === 0 ? 2.5 : 1.5}px solid ${T.dangerFg}; background: ${T.card}; text-align: center; padding: 0; ${FD}; font-size: 26px; font-weight: 600; color: ${T.strong}"></input>`).join('')}</div>`;
const SIDE_MAIL = ['Falta<br>um passo.', 'Confirmar o e-mail protege a sua conta e as suas tags.'];
const SIDE_CEL = ['Um número<br>que atende.', 'É por ele que quem achou o seu pet fala com você. Por isso confirmamos antes.'];
const SIDE_PASS = ['De volta<br>em um minuto.', 'Você cria uma senha nova e continua de onde parou.'];
const SIDE_MIN = ['Só o<br>necessário.', 'Nome, e-mail e celular. Nada de CPF ou endereço para ativar a sua tag.'];
const CEL_SUB = 'Enviamos um código de 6 dígitos por SMS para (11) 98765-4421. É esse número que aparece para quem encontrar seu pet.';
const mGrow = (S) => (S.k === 'm' ? grow(4) : '');
const F = (base, name, H, fn) => ({ base, name, group: 'conta', H, fn: (S, T_, h) => flow(S, fn(S, h)) });
const STD = { m: 844, t: 1024, d: 900 };

const flows = [
  F('confirmar-email', 'Confirme seu e-mail', STD, (S, h) => ({
    title: 'Confirme seu e-mail', h, bar: 'back', barHref: to('criar-conta', S), side: SIDE_MAIL,
    body: `${bigIcon(T, 'mail')}
${head(S, 'Confirme seu e-mail', 'Enviamos um link para <strong style="color: ' + T.strong + '">ana@email.com</strong>. Abra o e-mail e toque em “Confirmar meu e-mail”. O link vale por 1 hora.')}
${wait('Reenviar em 0:42')}
${note(T, 'info', 'Não achou? Olhe também a caixa de spam.')}
${mGrow(S)}`,
    footer: [btn(T, 'Reenviar e-mail', { fs: 18, disabled: true }), small(`E-mail errado? ${textLink(T, 'Voltar', to('criar-conta', S))}`), small(`Já confirmei. ${textLink(T, 'Entrar', to('entrar', S))}`)],
  })),
  F('confirmar-email-link', 'Confirmar e-mail · aberto pelo link', STD, (S, h) => ({
    title: 'Confirmar e-mail pelo link', h, side: SIDE_MAIL,
    body: `${bigIcon(T, 'mail')}
${head(S, 'Confirmar seu e-mail', 'Toque no botão para ativar sua conta.')}
${mGrow(S)}`,
    footer: [btn(T, 'Confirmar meu e-mail', { fs: 18, href: to('confirmar-celular', S) })],
  })),
  F('confirmar-email-invalido', 'Confirmar e-mail · link inválido', STD, (S, h) => ({
    title: 'Link de confirmação inválido', h, side: SIDE_MAIL,
    body: `${bigIcon(T, 'warn', 'danger')}
${head(S, 'Este link não vale mais', 'O link de confirmação vale por 1 hora e funciona uma vez só. Peça um novo: ele chega no seu e-mail em instantes.')}
${mGrow(S)}`,
    footer: [btn(T, 'Pedir novo link', { fs: 18, href: to('confirmar-email', S) }), btn(T, 'Entrar', { kind: 'ghost', h: 44, fs: 15, href: to('entrar', S) })],
  })),
  F('aceite-termos', 'Aceitar termos (conta Google)', STD, (S, h) => ({
    title: 'Aceitar termos', h, side: SIDE_MIN,
    body: `${head(S, 'Antes de continuar', 'Para usar o Faro, você precisa aceitar os Termos e a Política de privacidade.')}
<div style="background: ${T.card}; border-radius: 20px; padding: 14px 16px; display: flex; align-items: center; gap: 12px">${GOOGLE}<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">Você entrou com o Google</span><span style="font-size: 13px; color: ${T.muted}">ana@email.com</span></span></div>
${checkbox(T, 'attermos', `Li e aceito os ${textLink(T, 'Termos', to('legal-termos', S))} e a ${textLink(T, 'Política de privacidade', to('legal-termos', S))}.`)}
${mGrow(S)}`,
    footer: [btn(T, 'Aceitar e continuar', { fs: 18, href: to('informar-celular', S) }), btn(T, 'Sair', { kind: 'ghost', h: 44, fs: 15, href: to('boas-vindas', S) })],
  })),
  F('informar-celular', 'Informar celular', STD, (S, h) => ({
    title: 'Informar celular', h, side: SIDE_CEL,
    body: `${head(S, 'Qual é o seu celular?', 'É por ele que quem achou o seu pet fala com você. Vamos confirmar por SMS.')}
${field(T, 'iccel', 'Celular', { type: 'tel', value: '(11) 98765-4421', help: 'Com DDD. Só números do Brasil.' })}
${note(T, 'info', 'Sem celular confirmado, não dá para ativar uma tag.')}
${mGrow(S)}`,
    footer: [btn(T, 'Enviar código por SMS', { fs: 18, href: to('confirmar-celular', S) }), btn(T, 'Agora não', { kind: 'ghost', h: 44, fs: 15, href: to('painel', S) })],
  })),
  F('trocar-celular', 'Trocar celular', { m: 844, t: 1024, d: 900 }, (S, h) => ({
    title: 'Trocar celular', h, bar: 'close', barHref: to('conta-celular', S), side: SIDE_CEL,
    body: `${head(S, 'Novo celular', 'Vamos confirmar o número novo por SMS.')}
${alertBox(T, 'neu', 'info', 'Seu celular atual: (11) 98765-4421. Ele continua valendo até você confirmar o novo.')}
${field(T, 'tccel', 'Novo celular', { type: 'tel', ph: '(00) 00000-0000' })}
${field(T, 'tcsenha', 'Senha atual', { type: 'password', value: 'senhasegura', trail: eyeBtn(T), help: 'Pedimos a senha para ter certeza de que é você.' })}
${mGrow(S)}`,
    footer: [btn(T, 'Enviar código por SMS', { fs: 18, href: to('confirmar-celular', S) }), btn(T, 'Cancelar', { kind: 'ghost', h: 44, fs: 15, href: to('conta-celular', S) })],
  })),
  F('confirmar-celular-erro', 'Confirmar celular · código incorreto', STD, (S, h) => ({
    title: 'Confirmar celular: código incorreto', h, bar: 'back', barHref: to('informar-celular', S), side: SIDE_CEL,
    body: `${head(S, 'Confirme seu celular', CEL_SUB)}
${cellsErr()}
${alertBox(T, 'danger', 'warn', 'Código incorreto. Você tem mais 2 tentativas.')}
${wait('Reenviar em 0:18')}
${mGrow(S)}`,
    footer: [btn(T, 'Confirmar', { fs: 18, disabled: true }), small(`Número errado? ${textLink(T, 'Corrigir', to('informar-celular', S))}`)],
  })),
  F('confirmar-celular-vencido', 'Confirmar celular · código vencido ou bloqueado', STD, (S, h) => ({
    title: 'Confirmar celular: código vencido', h, bar: 'back', barHref: to('informar-celular', S), side: SIDE_CEL,
    body: `${head(S, 'Confirme seu celular', 'O código que enviamos para (11) 98765-4421 não vale mais.')}
${alertBox(T, 'neu', 'clock', 'Este código venceu. Peça um novo.')}
${note(T, 'info', 'A mesma tela aparece depois de muitas tentativas erradas, com o texto “Muitas tentativas. Peça um novo código.”')}
${mGrow(S)}`,
    footer: [btn(T, 'Reenviar código', { fs: 18, icon: 'refresh', href: to('confirmar-celular', S) }), small(`Número errado? ${textLink(T, 'Corrigir', to('informar-celular', S))}`)],
  })),
  F('confirmar-celular-indisponivel', 'Confirmar celular · SMS indisponível', STD, (S, h) => ({
    title: 'Confirmar celular: SMS indisponível', h, bar: 'back', barHref: to('informar-celular', S), side: SIDE_CEL,
    body: `${head(S, 'Confirme seu celular', 'Seu número fica guardado. Você pode tentar de novo agora ou confirmar depois, em Conta.')}
${alertBox(T, 'danger', 'warn', 'Não conseguimos enviar o SMS agora.')}
${note(T, 'info', 'Sem celular confirmado, não dá para ativar uma tag.')}
${mGrow(S)}`,
    footer: [btn(T, 'Tentar de novo', { fs: 18, icon: 'refresh', href: to('confirmar-celular', S) }), btn(T, 'Continuar sem confirmar', { kind: 'ghost', h: 44, fs: 15, href: to('painel', S) })],
  })),
  F('recuperar-senha', 'Esqueci a senha', STD, (S, h) => ({
    title: 'Esqueci a senha', h, bar: 'back', barHref: to('entrar', S), side: SIDE_PASS,
    body: `${head(S, 'Esqueceu a senha?', 'Informe seu e-mail. Enviamos um link para você criar uma nova.')}
${field(T, 'rsemail', 'E-mail', { type: 'email', value: 'ana@email.com' })}
${mGrow(S)}`,
    footer: [btn(T, 'Enviar link', { fs: 18, href: to('recuperar-senha-enviado', S) })],
  })),
  F('recuperar-senha-enviado', 'Esqueci a senha · link enviado', STD, (S, h) => ({
    title: 'Esqueci a senha: link enviado', h, side: SIDE_PASS,
    body: `${bigIcon(T, 'mail')}
${head(S, 'Confira seu e-mail', 'Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.')}
${wait('Você pode pedir outro link em 0:52')}
${mGrow(S)}`,
    footer: [btn(T, 'Voltar para entrar', { kind: 'outline', fs: 18, href: to('entrar', S) })],
  })),
  F('nova-senha', 'Criar nova senha', STD, (S, h) => ({
    title: 'Criar nova senha', h, side: SIDE_PASS,
    body: `${head(S, 'Crie uma nova senha', 'Use pelo menos 8 caracteres.')}
${field(T, 'nssenha', 'Nova senha', { type: 'password', value: 'novasenhasegura', trail: eyeBtn(T) })}
${mGrow(S)}`,
    footer: [btn(T, 'Salvar nova senha', { fs: 18, href: to('entrar', S) })],
  })),
  F('nova-senha-invalido', 'Criar nova senha · link inválido', STD, (S, h) => ({
    title: 'Link de recuperação inválido', h, side: SIDE_PASS,
    body: `${bigIcon(T, 'warn', 'danger')}
${head(S, 'Este link não vale mais', 'Peça um novo. Ele chega no seu e-mail em instantes.')}
${mGrow(S)}`,
    footer: [btn(T, 'Pedir novo link', { fs: 18, href: to('recuperar-senha', S) }), btn(T, 'Voltar para entrar', { kind: 'ghost', h: 44, fs: 15, href: to('entrar', S) })],
  })),
];

// ============================================================ app do tutor (claro e escuro)
const colW = (S, inner, w = 560) => (S.k === 'm' ? inner : `<div style="width: 100%; max-width: ${w}px; display: flex; flex-direction: column; gap: 16px">${inner}</div>`);
const hubHead = (S, X, t) => (S.k === 'm'
  ? `<div style="padding: 18px 20px 0; flex-shrink: 0"><h1 style="margin: 0; ${FD}; font-size: 30px; line-height: 1.1; font-weight: 700; letter-spacing: -0.03em; color: ${X.strong}">${t}</h1></div>`
  : `<h1 style="margin: 0; flex-shrink: 0; ${FD}; font-size: ${pick(S, 0, 28, 36)}px; line-height: 1.1; font-weight: 700; letter-spacing: -0.03em; color: ${X.strong}">${t}</h1>`);
const box = (X, inner, pad = '18px') => `<div style="background: ${X.card}; border-radius: 20px; padding: ${pad}; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0">${inner}</div>`;
// Em telas internas: no celular o botão principal fica ancorado embaixo; nas demais, dentro da coluna.
const inner = (S, X, h, title, body, actions = []) => app(S, X, {
  title, h, active: 'Conta', bar: 'back', barHref: fname('conta', S, X),
  body: S.k === 'm' ? `${body}${grow(4)}` : colW(S, `${body}${actions.length ? `<div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start">${actions.join('')}</div>` : ''}`),
  footer: S.k === 'm' ? actions : [],
});
const A = (base, name, H, fn) => ({ base, name, group: 'app', dark: true, H, fn });
const wide = (S, label, o) => ({ ...o, full: S.k === 'm' });

const conta = (S, X, h) => {
  const who = `<div style="background: ${X.card}; border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 14px; flex-shrink: 0"><span style="width: 56px; height: 56px; border-radius: 999px; background: ${X.selBg}; color: ${X.selFg}; display: flex; align-items: center; justify-content: center; ${FD}; font-size: 22px; font-weight: 600; flex-shrink: 0">A</span><span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="${FD}; font-size: 19px; font-weight: 600; color: ${X.strong}">Ana Souza</span><span style="font-size: 14px; color: ${X.muted}">ana@email.com</span></span></div>`;
  const trail = (b) => `<span style="display: flex; align-items: center; gap: 8px; flex-shrink: 0">${b}${ico('chev', 20, X.muted)}</span>`;
  const list = group(X, [
    row(X, { icon: 'user', title: 'Dados pessoais', sub: 'Nome e e-mail', href: fname('conta-dados', S, X) }),
    `<a href="${fname('conta-celular', S, X)}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; min-height: 44px; text-decoration: none; color: ${X.strong}">${tile40(X, 'phone')}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">Celular</span><span style="font-size: 13px; color: ${X.muted}">(11) 98765-4421</span></span>${trail(badge(X, 'Confirmado', 'ok'))}</a>`,
    row(X, { icon: 'lock', title: 'Senha', sub: 'Trocar a senha de entrada', href: fname('conta-senha', S, X) }),
    row(X, { icon: 'contrast', title: 'Aparência', sub: X.dark ? 'Escura' : 'Igual ao sistema', href: fname('conta-aparencia', S, X) }),
    row(X, { icon: 'shield', title: 'Privacidade', sub: 'Baixar ou excluir seus dados', href: fname('conta-privacidade', S, X) }),
  ]);
  const out = `<div style="display: flex; flex-shrink: 0">${btn(X, 'Sair', { kind: 'ghost', icon: 'exit', h: 48, fs: 16, full: false })}</div>`;
  const legal = `<p style="margin: 0; padding: 0 4px; font-size: 13px; color: ${X.muted}">${textLink(X, 'Termos de uso', fname('legal-termos', S, L), 13)} · ${textLink(X, 'Política de privacidade', fname('legal-termos', S, L), 13)}</p>`;
  return app(S, X, { title: 'Conta', h, hub: true, active: 'Conta', hubHeader: hubHead(S, X, 'Conta'), body: colW(S, `${who}${list}${out}${legal}`, 640) });
};
const roField = (X, id, label, value, help) => `<div style="display: flex; flex-direction: column; gap: 6px"><label for="${id}" style="font-size: 14px; font-weight: 600; color: ${X.strong}">${label}</label><input id="${id}" type="email" value="${value}" readonly style="height: 54px; width: 100%; box-sizing: border-box; border-radius: 12px; border: 1.5px solid ${X.border}; background: ${X.inset}; padding: 0 16px; ${FB}; font-size: 16px; color: ${X.muted}"></input><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${X.muted}">${ico('lock', 16, X.muted)}${help}</span></div>`;

const apps = [
  A('conta', 'Conta', { m: 844, t: 1024, d: 900 }, conta),
  A('conta-dados', 'Conta · dados pessoais', { m: 844, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Dados pessoais',
    `${field(X, 'cdnome', 'Nome', { value: 'Ana Souza' })}${roField(X, 'cdemail', 'E-mail', 'ana@email.com', 'O e-mail não pode ser alterado por aqui.')}`,
    [btn(X, 'Salvar alterações', wide(S, '', { fs: 18, disabled: true }))])),
  A('conta-celular', 'Conta · celular confirmado', { m: 844, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Celular',
    `${box(X, `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="${FD}; font-size: 26px; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; color: ${X.strong}">(11) 98765-4421</span>${badge(X, 'Confirmado', 'ok')}</div><span style="font-size: 14px; color: ${X.muted}">Confirmado em 02 nov 2026</span>`)}
${note(X, 'info', 'É por este número que quem escanear a tag abre uma conversa com você no WhatsApp.')}`,
    [btn(X, 'Trocar celular', wide(S, '', { kind: 'outline', fs: 17, href: fname('trocar-celular', S, L) }))])),
  A('conta-celular-pendente', 'Conta · celular não confirmado', { m: 844, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Celular',
    `${alertBox(X, 'neu', 'info', 'Seu celular ainda não foi confirmado. Sem isso, não dá para ativar uma tag.')}
${box(X, `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap"><span style="${FD}; font-size: 26px; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; color: ${X.strong}">(11) 98765-4421</span>${badge(X, 'Não confirmado', 'neu')}</div><span style="font-size: 14px; color: ${X.muted}">Informado no cadastro</span>`)}`,
    [btn(X, 'Confirmar celular', wide(S, '', { fs: 18, href: fname('informar-celular', S, L) }))])),
  A('conta-senha', 'Conta · senha', { m: 844, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Senha',
    `${field(X, 'cssatual', 'Senha atual', { type: 'password', value: 'senhasegura', trail: eyeBtn(X) })}${field(X, 'csnova', 'Nova senha', { type: 'password', ph: 'Pelo menos 8 caracteres', trail: eyeBtn(X) })}
${note(X, 'info', 'Ao trocar a senha, as outras sessões abertas são encerradas.')}`,
    [btn(X, 'Trocar senha', wide(S, '', { fs: 18 }))])),
  A('conta-aparencia', 'Conta · aparência', { m: 844, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Aparência',
    `<div style="display: flex; flex-direction: column; gap: 8px">${sectionLabel(X, 'Tema do app')}${segmented(X, ['Clara', 'Escura', 'Igual ao sistema'], X.dark ? 1 : 2, 'Tema do app')}</div>
${note(X, 'info', 'O tema vale só dentro do app. A página que as pessoas veem ao escanear a tag é sempre clara.')}`)),
  A('conta-privacidade', 'Conta · privacidade', { m: 900, t: 1024, d: 900 }, (S, X, h) => inner(S, X, h, 'Privacidade',
    `${box(X, `${h2(X, 'Baixar meus dados', 19)}<p style="margin: 0; font-size: 15px; line-height: 1.45; color: ${X.text}">Um arquivo com os dados da sua conta, dos seus pets, das suas tags e o histórico de scans.</p><div style="display: flex; margin-top: 4px">${btn(X, 'Baixar meus dados', { kind: 'outline', icon: 'download', h: 48, fs: 16, full: false })}</div>`)}
${box(X, `${h2(X, 'Excluir minha conta', 19)}${['Suas tags são desvinculadas e ficam livres para uma nova ativação.', 'A página de resgate deixa de mostrar os seus dados.', 'Não dá para desfazer.'].map((t) => `<div style="display: flex; align-items: flex-start; gap: 10px; font-size: 15px; line-height: 1.45; color: ${X.text}">${ico('close', 20, X.dangerFg)}<span>${t}</span></div>`).join('')}<div style="display: flex; margin-top: 2px">${btn(X, 'Excluir minha conta', { kind: 'danger', icon: 'trash', h: 48, fs: 16, full: false, href: fname('conta-excluir', S, X) })}</div>`)}`)),
  A('conta-excluir', 'Conta · confirmar exclusão', { m: 900, t: 1024, d: 900 }, (S, X, h) => {
    const bg = X.dark ? X.dangerFg : '#A52E22';
    const fg = X.dark ? '#13201E' : '#FFFFFF';
    const dialog = `<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(8, 11, 32, 0.62); display: flex; align-items: ${S.k === 'm' ? 'flex-end' : 'center'}; justify-content: center; padding: 16px; box-sizing: border-box">
<div role="alertdialog" aria-modal="true" aria-labelledby="exttl" style="width: 100%; max-width: 440px; background: ${X.card}; border-radius: 24px; padding: 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; box-shadow: ${X.shadow}">
<h2 id="exttl" style="margin: 0; ${FD}; font-size: 24px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; color: ${X.strong}">Excluir sua conta?</h2>
<p style="margin: 0; font-size: 15px; line-height: 1.45; color: ${X.text}">Seus dados são apagados e as suas tags ficam sem dono. Não dá para desfazer.</p>
${field(X, 'exconf', 'Digite EXCLUIR para confirmar', { value: 'EXCLUIR' })}
${field(X, 'exsenha', 'Senha atual', { type: 'password', value: 'senhasegura', trail: eyeBtn(X) })}
<button style="height: 56px; width: 100%; border: none; border-radius: 999px; background: ${bg}; color: ${fg}; ${FD}; font-size: 17px; font-weight: 600">Excluir definitivamente</button>
${btn(X, 'Cancelar', { kind: 'outline', h: 52, fs: 16, href: fname('conta-privacidade', S, X) })}
</div></div>`;
    return inner(S, X, h, 'Privacidade', `${box(X, `${h2(X, 'Baixar meus dados', 19)}<p style="margin: 0; font-size: 15px; line-height: 1.45; color: ${X.text}">Um arquivo com os dados da sua conta, dos seus pets, das suas tags e o histórico de scans.</p>`)}${box(X, `${h2(X, 'Excluir minha conta', 19)}<p style="margin: 0; font-size: 15px; line-height: 1.45; color: ${X.text}">Suas tags são desvinculadas e ficam livres para uma nova ativação.</p>`)}${dialog}`);
  }),
];

// ----- Seus pets (spec 003) -----
const petRow = (S, X, name, sub, b, hasPhoto) => `<a href="${fname('pet', S, X)}" style="display: flex; align-items: center; gap: 12px; background: ${X.card}; border-radius: 20px; padding: 14px; text-decoration: none; color: ${X.strong}">${avatar(X, 56, hasPhoto)}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0"><span style="font-size: 16px; font-weight: 600">${name}</span><span style="font-size: 13px; color: ${X.muted}">${sub}</span><span>${b}</span></span>${ico('chev', 20, X.muted)}</a>`;
const addPet = (S, X) => `<a href="${fname('novo-pet-dados', S)}" style="min-height: 84px; border-radius: 20px; border: 1.5px dashed ${X.control}; box-sizing: border-box; color: ${X.strong}; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 600">${ico('plus', 20, X.strong)}Adicionar pet</a>`;
const petsScreen = (S, X, h) => {
  const items = `${petRow(S, X, 'Paçoca', 'Cão · vira-lata · 4 anos', badge(X, 'Tag ativa', 'ok'), true)}${petRow(S, X, 'Mel', 'Gata · siamesa · 2 anos', badge(X, 'Sem tag', 'neu'), false)}${addPet(S, X)}`;
  const count = `<p style="margin: 0; padding: 0 4px; font-size: 14px; color: ${X.muted}; flex-shrink: 0">2 pets · 1 tag ativa</p>`;
  const list = S.k === 'm' ? items : `<div style="display: grid; grid-template-columns: repeat(${pick(S, 1, 2, 3)}, minmax(0, 1fr)); gap: ${pick(S, 12, 16, 20)}px; flex-shrink: 0">${items}</div>`;
  return app(S, X, { title: 'Seus pets', h, hub: true, active: 'Pets', hubHeader: hubHead(S, X, 'Seus pets'), body: `${count}${list}` });
};

// ----- Termos e Política (mesmo desenho para as duas páginas) -----
const legal = (S, h) => {
  const secs = [
    ['1. O que é o Faro', 'O que a tag faz, o que a página de resgate mostra e o que o Faro não promete.'],
    ['2. Sua conta', 'Quem pode criar uma conta, o que você informa e como manter o acesso seguro.'],
    ['3. A tag e a página de resgate', 'O que aparece para quem escaneia a tag e quem decide isso: você.'],
    ['4. O que não é permitido', 'Usos que levam ao bloqueio de uma tag ou de uma conta.'],
    ['5. Encerrar a conta', 'Como excluir a conta e o que acontece com os seus dados e as suas tags.'],
  ];
  const pad = pick(S, '20px 20px 32px', '32px 0 48px', '40px 0 64px');
  return page('Termos de uso' + pick(S, ' · celular', ' · tablet', ' · desktop'), S.w, h, T, 'flex-direction: column', `<div style="padding: ${pick(S, '14px 20px', '20px 28px', '24px 48px')}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0">${logoImg(LOGO, pick(S, 40, 48, 52))}${textLink(T, 'Entrar', to('entrar', S), 15)}</div>
<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; padding: ${pad}">
<div style="width: 100%; max-width: 680px; display: flex; flex-direction: column; gap: 18px">
<div>${h1(T, 'Termos de uso', pick(S, 34, 44, 48))}${para(T, 'Última atualização: a definir', 14, 10, `color: ${T.muted}`)}</div>
${alertBox(T, 'neu', 'info', 'Modelo de página. O texto final dos Termos e da Política de privacidade será publicado antes da abertura do Faro.')}
${secs.map(([t, p]) => `<div style="display: flex; flex-direction: column; gap: 6px">${h2(T, t, pick(S, 20, 22, 22))}<p style="margin: 0; font-size: 16px; line-height: 1.6; color: ${T.text}">${p}</p></div>`).join('')}
</div></div>
<div style="position: relative; flex-shrink: 0; background: ${NAVY[700]}; padding: ${pick(S, '18px 20px 20px', '22px 28px', '24px 48px')}; overflow: hidden; display: flex; flex-direction: column; gap: 6px">
${focinho(250, NAVY[600], 'position: absolute; right: -78px; top: -34px')}
<span style="position: relative; ${FD}; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF">O caminho de volta para casa.</span>
<span style="position: relative; font-size: 13px; color: ${NAVY[100]}">Termos de uso · Política de privacidade</span>
</div>`);
};

module.exports = [
  ...flows,
  ...apps,
  { base: 'pets', name: 'Seus pets', group: 'app', dark: true, H: { m: 844, t: 1024, d: 900 }, fn: (S, X, h) => petsScreen(S, X, h) },
  { base: 'legal-termos', name: 'Termos e Política (modelo)', group: 'pub', H: { m: 900, t: 1024, d: 900 }, fn: (S, T_, h) => legal(S, h) },
];
