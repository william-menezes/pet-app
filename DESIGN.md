---
name: Faro
description: O caminho de volta para casa.
colors:
  lime: "#84C32E"
  lime-hover: "#76B027"
  lime-press: "#689B22"
  ink: "#13201E"
  navy-50: "#EEF0F8"
  navy-100: "#DADFF0"
  navy-200: "#B8C0E2"
  navy-300: "#8E9ACF"
  navy-400: "#6574B8"
  navy-500: "#44549F"
  navy-600: "#32418C"
  navy-700: "#25337A"
  navy-800: "#1A2459"
  navy-900: "#0E1336"
  navy-950: "#080B20"
  amber-band: "#A85A0E"
  amber-icon: "#C26A12"
  amber-soft: "#FBF1DD"
  amber-text: "#8A4A0C"
  ground: "#F7F8F8"
  surface: "#FFFFFF"
  divider: "#EEF0F1"
  border: "#E2E5E7"
  border-control: "#7F8B88"
  text: "#33403D"
  muted: "#5E6C69"
  success-soft: "#E4F4EA"
  success-text: "#0F5E30"
  danger: "#C23A2B"
  danger-soft: "#FBE7E4"
  danger-text: "#A52E22"
  photo-ground: "#E8E2D6"
  dark-ground: "#0B0F2A"
  dark-surface: "#161C4A"
  dark-inset: "#1F2760"
  dark-border: "#2B3470"
  dark-border-control: "#7C87C4"
  dark-ink: "#F3F5FC"
  dark-text: "#D8DCF0"
  dark-muted: "#A6ADD0"
typography:
  display:
    fontFamily: "Outfit, Inter, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Outfit, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
  button:
    fontFamily: "Outfit, Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
rounded:
  input: "12px"
  card-sm: "16px"
  card: "20px"
  hero: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
  "3xl": "32px"
  "4xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
  button-primary-active:
    backgroundColor: "{colors.lime-press}"
  button-rescue:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "60px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "54px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "38px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  lost-block:
    backgroundColor: "{colors.amber-band}"
    textColor: "{colors.surface}"
  brand-panel:
    backgroundColor: "{colors.navy-700}"
    textColor: "{colors.surface}"
---

# Design System: Faro

## Overview

**Creative North Star: "O caminho de volta para casa"**

O Faro é uma tag de coleira com QR Code. Cada tela é um passo entre "perdido" e "em casa", e o
sistema visual existe para que quem achou um pet na rua entenda o que fazer em dez segundos e
para que o tutor confie que a tag vai funcionar no dia em que precisar. O critério para cortar
um elemento é simples: ele ajuda alguém a dar o próximo passo? Se não, sai.

A interface é clara, direta e calorosa. A foto do pet é a protagonista. Uma única cor age, uma
única cor marca seleção, e o texto grande fala na voz do pet. Não há decoração que não venha do
próprio produto: o único motivo gráfico é o focinho do logo em escala gigante.

As telas de referência são as páginas "MVP v2" do canvas *Faro · Telas do MVP* no Claude Design
(87 telas: 25 telas em celular, tablet e desktop, mais 12 versões escuras do app do tutor), com
cópia em `design/telas-v2/`. O William aprovou a direção em 12 telas-piloto (resgate, modo perdido,
painel e entrar); as demais seguem o mesmo sistema e ainda não foram revisadas por ele, e nenhuma
foi conferida renderizada. Em conflito, este arquivo vence a tela. O
design system está em *Faro Design System*, no mesmo lugar.

**Key Characteristics:**
- Quatro regras de cor, e cada uma proíbe algo (ver Colors).
- Um título grande por tela, em Outfit, que carrega a mensagem.
- Foto do pet em área grande: topo da página de resgate, capa do painel.
- Cartões planos, brancos sobre cinza muito claro, sem borda e sem sombra.
- Uma ação principal por tela.
- Três larguras por tela: celular, tablet e desktop.

## Colors

Uma cor age, uma seleciona, uma é marca e uma avisa. O resto é neutro.

### Primary
- **Lima do focinho** (`#84C32E`, texto `#13201E`): a cor de **ação**. Botão principal e o
  único cartão da tela que pede uma ação (por exemplo, "Alguém escaneou a tag do Paçoca").
  Hover `#76B027`, pressionado `#689B22`. É também a cor do focinho no logo.

### Secondary
- **Navy da marca** (`#25337A`, passo 700 da escala): wordmark, painéis de marca, rodapé da
  página de resgate, links (sublinhados). Texto branco sobre ele tem 11,5:1; texto secundário
  sobre navy usa `#DADFF0`. `#0E1336` (Noturno) é a base do tema escuro. A escala 50–950 foi
  regenerada a partir de `#25337A`.

### Tertiary
- **Âmbar do modo perdido** (`#A85A0E` no bloco, texto branco 5,1:1; `#C26A12` para ícones e
  pinos; `#FBF1DD` com texto `#8A4A0C` para fundos suaves). "Urgência calma."

### Neutral
- **Tinta** (`#13201E`): títulos, rótulos, texto de campos e a cor de **seleção**.
- **Texto** (`#33403D`) e **texto secundário** (`#5E6C69`, mínimo 4,5:1 sobre fundo e cartão).
- **Fundo** (`#F7F8F8`) e **superfície** (`#FFFFFF`).
- **Divisor** (`#EEF0F1`), **borda decorativa** (`#E2E5E7`) e **borda de controle** (`#7F8B88`,
  1,5px, 3,5:1: é a única borda que pode ser a aresta de um campo).
- **Estados**: sucesso `#E4F4EA` / `#0F5E30`; perigo `#C23A2B`, suave `#FBE7E4` / `#A52E22`.

### Tema escuro (só no app autenticado do tutor)
Fundo `#0B0F2A`, cartão `#161C4A`, área interna `#1F2760`, borda `#2B3470`, borda de controle
`#7C87C4`; tinta `#F3F5FC`, texto `#D8DCF0`, secundário `#A6ADD0`; links `#B8C0E2`. Lima e âmbar
não mudam. A seleção inverte: pílula clara (`#F3F5FC`) com texto escuro.

### Named Rules
**Lima age.** Lima é ação. Nunca é estado selecionado, nunca é texto sobre branco (2,1:1),
nunca é marca pequena sobre branco (check, barra de progresso, ponto). Para isso use tinta.

**Tinta seleciona.** Aba ativa, chip escolhido, segmento, item de navegação, caixa marcada e
interruptor ligado são tinta com texto branco. No escuro, o inverso.

**Navy é marca.** Navy não é cor de botão.

**Âmbar é só modo perdido.** Fora do modo perdido, âmbar aparece apenas no atalho que leva a
ele. Nunca vermelho em tela cheia: vermelho é só para ação destrutiva.

**Ícone oficial.** WhatsApp e Google usam o ícone da própria empresa. O botão do WhatsApp é
lima com o ícone em tinta; o do Google é branco com contorno e o "G" nas quatro cores.

## Typography

**Display Font:** Outfit (com Inter, system-ui)
**Body Font:** Inter (com system-ui)

**Character:** Outfit é geométrica, redonda e pesada: fala alto e amigável em tamanho grande.
Inter cuida da leitura em tamanho pequeno. Não há monoespaçada: o código da tag é escrito em
Outfit 600/700.

### Hierarchy
- **Display** (700, 40–46px no celular, 56–72px em tablet e desktop, entrelinha 1,0, tracking
  -0,03em): a frase que carrega a tela. "Oi, eu sou o Paçoca." Uma por tela.
- **Headline** (700, 28–36px, 1,04): título de tela no app e nos fluxos.
- **Title** (600, 18–22px, 1,15): título de seção e de cartão; números de resumo em 34–40px/700.
- **Body** (400, 15–17px, 1,45): texto corrido. Nunca abaixo de 15px; 16–17px no resgate.
- **Label** (600, 13–14px): rótulos de campo, chips, selos, legendas.
- **Button** (Outfit 600, 17–18px na ação principal, 15px em botões pequenos).

### Named Rules
**Uma frase grande.** Cada tela tem uma linha de display. Se duas competem, uma vira headline.

**A voz do pet.** Na página de resgate o display é em primeira pessoa, do pet. O recado do
tutor mantém a voz do tutor e é rotulado como tal.

**Sem rótulo acima do título.** Nada de "eyebrow" em caixa alta sobre o display.

## Layout

Mobile first, em três larguras. A base é o celular (390px); `md` (768px) é o tablet; `xl`
(1280px) é o desktop, desenhado em 1440px.

- **Navegação do app**: barra em pílula flutuante embaixo no celular, só nas telas-raiz
  (Início, Pets, Scans, Conta); trilho lateral de 88px com ícones no tablet; menu lateral de
  264px com o wordmark no desktop.
- **Páginas públicas e de conta**: a foto do pet, ou o painel navy da marca, é a faixa do topo
  no celular e no tablet e vira a metade esquerda no desktop. O conteúdo entra numa folha de
  cantos arredondados (28–32px) que sobe sobre a foto.
- **Formulários e fluxos**: uma coluna de 440–480px. Centralizada no tablet; ao lado do painel
  de marca no desktop. No celular a ação principal fica ancorada embaixo.
- **Telas do app**: pilha de blocos no celular; duas colunas no tablet quando ajuda; no desktop,
  grade de 440px + restante, com conteúdo extra que só cabe lá (por exemplo, "Últimos scans").
- **Admin**: menu lateral no desktop; barra no topo com abas roláveis em tablet e celular.
  Tabelas viram lista de cartões no celular.
- **Ritmo**: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48. Margem lateral de 16–20px no celular. Grupos
  apertados, separação generosa. Alvo de toque mínimo de 44px.
- **Página pública**: sem overlay (dialog, popover, sheet). Utilizável antes da hidratação.

## Elevation & Depth

O sistema é plano. A profundidade vem de tom: cartão branco sobre fundo `#F7F8F8`, e uma área
interna (`#F7F8F8` no claro, `#1F2760` no escuro) para ícones e mapas dentro do cartão.

### Shadow Vocabulary
- **Flutuante** (`box-shadow: 0 12px 34px rgba(19,32,30,.14), 0 3px 10px rgba(19,32,30,.06)`):
  só a barra de navegação inferior do celular, e avisos temporários.

### Named Rules
**Borda ou sombra, nunca os dois.** Cartões não têm borda nem sombra.

## Shapes

Formas redondas e amigáveis, vindas do próprio focinho.

- **Pílula** (999px): botões, chips, selos, itens de navegação, campo de busca.
- **12px**: campos de formulário, células do PIN, ícones em quadrado dentro de cartões.
- **16–20px**: cartões e linhas de lista. **24px**: capa com foto e cartão lima. **28–32px**:
  cantos superiores da folha que sobe sobre a foto.
- **O focinho gigante**: a forma do logo em escala grande, sangrando para fora da borda. Lima
  sobre painéis navy e no fundo do login; `#32418C` sobre o rodapé navy. Só em momentos de
  marca, uma vez por tela, nunca atrás de texto corrido, nunca lima sobre lima.

## Components

- **Botão principal**: pílula lima, texto tinta em Outfit 600, 56px (60px na página de
  resgate). Um por tela. Rótulo é verbo + objeto: "Ativar minha tag", nunca "OK".
- **Botão de contorno**: pílula branca com contorno de 1,5px em tinta. Ação secundária e o
  botão do Google.
- **Botão tinta**: pílula tinta com texto branco, 44px. Ação dentro do cartão lima.
- **Botão de texto**: sem fundo. Saída do fluxo ("Agora não"). Em vermelho-texto para destrutivo.
- **Campo**: 54px, raio 12, borda de controle de 1,5px, rótulo acima, ajuda abaixo.
- **Células do PIN e do código por SMS**: seis caixas de 60px, caractere em Outfit 26/600.
- **Interruptor, caixa e rádio**: ligados em tinta. Desligados com a borda de controle.
- **Chip**: pílula branca com borda decorativa; selecionado em tinta.
- **Segmentado**: trilho em pílula branca; opção escolhida em tinta.
- **Cartão e linha de lista**: branco, raio 20; linha com ícone em quadrado de 40px, título,
  subtítulo e um único item à direita (seta, selo ou interruptor).
- **Capa do pet**: foto em cartão de raio 24–28 com véu escuro só na base, nome em display branco.
- **Cartão de ação**: lima, raio 24, título em Outfit e botão tinta. Um por tela, no máximo.
- **Cartão de número**: rótulo, número em Outfit 34–40/700 e legenda.
- **Bloco do modo perdido**: âmbar `#A85A0E`, display branco, selos brancos com texto âmbar.
- **Painel de marca**: navy `#25337A` com o wordmark de letras brancas, o focinho gigante em
  lima e, no desktop, a tagline em display.
- **Rodapé da página de resgate**: navy, com a tagline, uma linha de confiança e o código da tag.
- **Selos**: pílula de 24px. Verde para "ativa/precisa", neutro para "disponível/aproximada",
  âmbar para "bloqueado", vermelho suave para "anulado".
- **Foco**: anel de 2px em tinta com folga branca de 2px (no escuro, anel claro).
- **Movimento**: transições de ~150ms em cor e borda; respeitar `prefers-reduced-motion`.

## Do's and Don'ts

**Faça**
- Comece cada tela pela frase grande e pela ação principal.
- Use a foto do pet em área grande sempre que houver foto.
- Termine todo estado vazio ou de erro com um próximo passo.
- Desenhe e teste as três larguras.
- Confira contraste: 4,5:1 em texto, 3:1 em borda de controle e ícone, nos dois temas.

**Não faça**
- Não use lima como seleção, texto sobre branco ou marca pequena.
- Não use `#3A4FD6` nem os tons antigos de índigo: saíram da marca.
- Não use Poppins nem monoespaçada.
- Não use emoji na interface.
- Não troque o ícone do WhatsApp ou do Google por um genérico.
- Não ponha borda e sombra no mesmo cartão; não aninhe cartões.
- Não use overlay na página pública.
- Não aplique o tema escuro na página de resgate, nos fluxos de conta e ativação ou no admin.
- Não copie telas, textos ou motivos do app de referência (Bramble); ele inspirou princípios.
