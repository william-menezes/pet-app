# Brief para o Claude Design — Feature 001-login

> **Escopo:** tela de login do painel autenticado do Faro (porta única — Tutor e Admin).
> **Referência:** [`design-system.md`](../../docs/design-system.md) (Paleta C, FaroPreset, tokens) e [`ui-ux.md`](./ui-ux.md) (blueprint de estados e microcopy).
> **Stack alvo:** Angular 21 + PrimeNG tema Aura (FaroPreset) — o Claude Design gera referência visual; implementação é no `frontend-angular`.

## Como usar
1. No **claude.ai → Claude Design**, crie um projeto novo.
2. (Recomendado) Anexe `docs/design-system.md` para herdar os tokens.
3. Cole o prompt da seção abaixo.
4. Peça 2–3 variações; itere por comentários inline.
5. Exporte como referência visual; handoff ao `frontend-angular` via `ui-ux.md`.

---

## Prompt para colar no Claude Design

```
Gere a tela de LOGIN do painel autenticado do "Faro" — app SaaS de cuidado de saúde e tag QR de resgate para pets (Brasil, PT-BR).

CONTEXTO DO PRODUTO: Faro é para tutores de cães e gatos. Marca: acolhedora, confiável, calma, clara. NÃO infantil, NÃO alarmista, NÃO corporativo-frio. Tagline: "Faro: o caminho de volta para casa." Esta é a porta única de entrada para Tutores e Admins — não diferencia papéis na tela.

TRATAMENTO DE DESIGN: utilitário polished, não editorial. Card de login centralizado. Sem hero excessivo. Hierarquia tipográfica cuidadosa. Estados funcionais completos.

TEMA: claro (light), mobile-first (~360px), expandindo para desktop. WCAG 2.1 AA obrigatório em todos os elementos.

CORES (use exatamente estes tokens — Paleta C "Faro Noturno", SELECIONADA):
- Primária Índigo: 500 #3A4FD6 (botão primário; texto branco passa AA-normal 6.42:1) · 600 #2D3CAC (hover/pressed) · 700 #212C80 (títulos e pressed).
- Accent Verde-Lima #7FBF3F — NÃO usar nesta tela (é para CTAs de resgate e selos).
- Âmbar modo perdido #C26A12 — NÃO usar nesta tela.
- Semânticas: danger texto #C23A2B · fundo danger #FBE7E4 · info texto #1F6FB2 · fundo info #E3F0FA · warn texto #946005 · fundo warn #FBF1DD.
- Superfícies: fundo de página #F7F8F8 · card #FFFFFF · borda #E2E5E7 · texto forte #13201E · texto padrão #33403D · texto muted #5E6C69.
- Sombra de card: 0 1px 3px rgba(19,32,30,.08), 0 4px 12px rgba(19,32,30,.06).

TIPOGRAFIA:
- Marca "Faro": Poppins 700, 24px, índigo #3A4FD6. Compacto, no topo do card.
- Título da tela: Poppins 700, 22px, #13201E. Texto: "Bem-vindo de volta".
- Subtítulo: Inter 400, 14px, #5E6C69. Texto: "Entre na sua conta para acessar o Faro."
- Labels de campo: Inter 500, 14px, #33403D.
- Texto dos botões: Inter 600, 16px.
- Erros inline: Inter 400, 12px, #C23A2B.
- Links: Inter 500, 14px, #3A4FD6, underline no hover.
- Caption rodapé: Inter 400, 12px, #5E6C69. Texto: "Protegido por Faro 🐾".

FORMA/ESPAÇO: border-radius do card 20px. Campos 48px de altura. Botões 48px full-width. Raios internos 8px (campos), 12px (botões). Espaço entre campos: 16px. Espaço entre seções: 24px. Padding do card: 32px. Max-width do card: 440px.

COMPONENTES A GERAR (mostre cada estado indicado):

1. CARD DE LOGIN COMPLETO — estado padrão (vazio, pronto para uso):
   - Logo "Faro" (Poppins 700 índigo, sem ícone de logo por enquanto)
   - Título "Bem-vindo de volta"
   - Subtítulo "Entre na sua conta para acessar o Faro."
   - Campo E-mail (label acima, placeholder sutil, altura 48px, borda #E2E5E7)
   - Campo Senha (label acima, toggle de visibilidade [ícone olho], altura 48px)
   - Checkbox "Manter conectado" (alvo de toque ≥ 44px; Inter 14px label)
   - Botão "Entrar" (primário, full-width, 48px, índigo #3A4FD6, texto branco, Poppins 600)
   - Divisor "ou" (linha horizontal com texto "ou" centralizado, Inter 12px muted)
   - Botão "Entrar com Google" (outlined, full-width, 48px, ícone G colorido à esquerda, texto "Entrar com Google", Inter 600, borda #E2E5E7)
   - Link "Esqueceu a senha?" (Inter 500 14px índigo, alinhado à esquerda)
   - Texto "Ainda não tem conta? Criar conta" (Inter 400 14px muted + link "Criar conta" índigo)
   - Rodapé "Protegido por Faro 🐾" (caption 12px muted, centralizado)

2. ESTADO: Loading (submit em progresso)
   - Botão "Entrar" com spinner interno + texto "Entrando..." (disabled)
   - Botão Google disabled
   - Campos disabled
   - Foco visual permanece no botão

3. ESTADO: Erro de credencial (anti-enumeração — IMPORTANTE)
   - Banner de erro no TOPO do form, ANTES dos campos (não inline por campo)
   - Cor fundo danger #FBE7E4, texto #C23A2B, ícone ⚠
   - Texto: "E-mail ou senha inválidos. Verifique e tente de novo."
   - Campos NÃO têm borda de erro individual (o erro é do formulário, não do campo)
   - role="alert" indicado no banner

4. ESTADO: Rate-limit / bloqueio
   - Banner warn (#FBF1DD / #946005)
   - Texto: "Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar de novo."
   - Botão "Entrar" disabled; botão Google pode permanecer habilitado

5. ESTADO: E-mail não confirmado
   - Banner info (#E3F0FA / #1F6FB2)
   - Texto: "Confirme seu e-mail para entrar. Não recebeu o e-mail de confirmação?"
   - Botão text inline: "Reenviar e-mail de confirmação" (Inter 500, índigo, sem fundo)

6. ESTADO: Google indisponível
   - Banner warn
   - Texto: "Login com Google está indisponível agora. Entre com e-mail e senha."
   - Botão Google disabled

7. VALIDAÇÃO INLINE de formato (erros de campo — SÓ para formato, nunca para existência)
   - Campo e-mail com borda danger + texto abaixo: "O e-mail precisa ter um @."
   - Campo senha vazio com borda danger + texto: "Informe sua senha."
   - Ícone ⚠ pequeno opcional à direita do campo

8. TELA DE CALLBACK Google (rota /auth/callback — estado de processamento)
   - Mesma estrutura de card, sem o formulário
   - Spinner centralizado (índigo)
   - Texto: "Verificando..."
   - Subtítulo: "Estamos validando seu acesso com o Google. Um momento."

9. TOAST: Logout confirmado
   - Chip/toast success (#E4F4EA / #157A3F)
   - Texto: "Você saiu com segurança."
   - Aparece na tela de login após logout

10. BANNER: Sessão expirada
    - Banner info no topo do form
    - Texto: "Sua sessão expirou. Entre de novo para continuar de onde parou."

VARIANTES DE LAYOUT:
- Mobile (~360px): card full-width, sem bordas visíveis, padding lateral 16px. Logo + título centralizados.
- Tablet/Desktop (≥768px): card centralizado, max-width 440px, bordas visíveis, sombra suave, fundo de página #F7F8F8 ao redor.

ACESSIBILIDADE OBRIGATÓRIA:
- Outline de foco visível em todos os interativos: 2px solid #3A4FD6, offset 2px.
- Labels associadas aos campos (NÃO usar apenas placeholder como label).
- Indicar "required" visualmente (não só com asterisco sem legenda).
- Erros anunciados por leitor de tela (indicar aria-live na anotação).
- Checkbox com área clicável ≥ 44x44px.
- Toggle de senha com aria-label indicado.

MICROCOPY: PT-BR, tom honesto + útil nos erros (não culpa o usuário), calmo e acolhedor no estado padrão. Rótulo de botão = verbo + objeto.

ENTREGUE:
- 2–3 variações de layout (mesma paleta; diferenças de espaçamento, peso tipográfico, densidade).
- Para cada variação: estado padrão + pelo menos os estados 3 (erro de credencial) e 2 (loading).
- Revisão de acessibilidade (contraste, foco visível, ordem de leitura, semântica).
- Anotações breves indicando aria-roles e aria-live nos elementos críticos.
```

---

## Referência de tokens CSS para o Claude Design

```css
/* Tokens do Faro — Paleta C (Índigo + Lima), SELECIONADA */
/* Fonte: docs/design-system.md §8 e src/styles/faro-tokens.css */

--faro-primary: #3A4FD6;
--faro-primary-hover: #2D3CAC;
--faro-primary-strong: #212C80;
--faro-surface-0: #FFFFFF;        /* card */
--faro-surface-app: #F7F8F8;      /* fundo de página */
--faro-border: #E2E5E7;
--faro-text-strong: #13201E;      /* títulos */
--faro-text: #33403D;             /* corpo */
--faro-text-muted: #5E6C69;       /* labels e legendas */
--faro-danger: #C23A2B;           /* texto de erro */
--faro-danger-bg: #FBE7E4;        /* fundo de banner de erro */
--faro-info: #1F6FB2;             /* texto info */
--faro-info-bg: #E3F0FA;          /* fundo de banner info */
--faro-warn: #946005;             /* texto warn */
--faro-warn-bg: #FBF1DD;          /* fundo de banner warn */
--faro-radius-sm: 8px;            /* campos */
--faro-radius-md: 12px;           /* botões */
--faro-radius-lg: 20px;           /* card de login */
--faro-shadow-card: 0 1px 3px rgba(19,32,30,.08), 0 4px 12px rgba(19,32,30,.06);
--faro-touch-min: 44px;           /* alvos de toque mínimos */
--faro-font-display: "Poppins", system-ui, sans-serif;
--faro-font-body: "Inter", system-ui, sans-serif;
```

## O que NÃO usar nesta tela

- **Accent verde-lima** (#7FBF3F): reservado para CTAs de resgate e selos de recompensa.
- **Faixa âmbar** (`--faro-lost-band`): exclusivo do modo perdido.
- **Vermelho danger em tela cheia**: só em banners e textos de erro, nunca como cor de fundo de página.
- **Ícones de pata 🐾** no formulário (apenas no rodapé, com parcimônia).
- **Mais de uma ação primária**: "Entrar" é a única ação primária; Google é secundária.
