# Contrato: tokens de design e tema (`src/styles.css`)

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21
**Fontes** (em ordem de autoridade): `docs/decisoes-pivo.md` > `CLAUDE.md` > `DESIGN.md` >
`docs/zardui-faro.md` > `design/telas-v2-gerador/lib.js` (objetos `L` e `D`).

Este arquivo é a **única referência de valores** para quem implementa. A pasta `design/` não é
versionada; por isso todo número que importa foi copiado para cá. Onde as fontes discordam, a
decisão está em `research.md` §R6, e o valor que vale é o deste contrato.

## 1. Regras que não cedem

1. **Um único arquivo de tema**: `src/styles.css`. Nenhum outro arquivo em `src/` declara
   variáveis de cor, raio, fonte ou sombra. Não existe `src/styles/`, não existe `src/theme/`.
   `angular.json` lista só `src/styles.css` em `styles`.
2. **Nada de cor solta no código**: em `src/app/**` não há cor em hexadecimal, `rgb()` ou `hsl()`.
   Usa-se a classe utilitária do token (`bg-primary`, `text-muted-foreground`). Única exceção:
   o "G" do Google (`google-glyph.ts`), que tem as quatro cores oficiais.
3. **Lima age.** `bg-primary` só em botão principal e no cartão de ação. Nunca é estado
   selecionado, nunca é texto sobre fundo claro, nunca é marca pequena (check, barra, ponto).
4. **Tinta seleciona.** Todo estado "escolhido" (item de navegação, chip, segmento, caixa
   marcada, interruptor ligado) é `bg-foreground text-background`. Escrito assim, inverte
   sozinho no tema escuro.
5. **Navy é marca.** `bg-brand` em painel de marca e rodapé público; `text-link` em links.
   Navy não é cor de botão.
6. **Âmbar é só modo perdido.** `bg-lost`, `text-amber`, `bg-warning-soft` só aparecem no modo
   perdido, no atalho que leva a ele e no selo "Bloqueado" do admin. Vermelho só em ação
   destrutiva e em mensagem de erro.
7. **Sobre lima, o texto é sempre `text-primary-foreground`** (tinta fixa). `text-foreground`
   sobre lima no tema escuro dá 1,96:1 e é proibido.
8. **Tema escuro só dentro de `.dark`**, e `.dark` só é aplicada pela casca do app do tutor
   (ver `shells.contract.md` §6). Nunca em `html`, `body` ou `:root`.
9. **Fontes servidas pelo próprio domínio.** Nenhuma requisição a `fonts.googleapis.com` nem
   `fonts.gstatic.com`. Só Outfit e Inter. Não há Poppins nem fonte monoespaçada.
10. **Sem emoji** em texto de interface.

## 2. Tokens (valor claro e valor escuro)

A coluna "Classe" mostra o nome que o Tailwind gera a partir de `@theme inline`.

### 2.1 Variáveis no formato shadcn (lidas pelos componentes ZardUI)

| Variável | Claro | Escuro | Classe | Papel |
|---|---|---|---|---|
| `--background` | `#F7F8F8` | `#0B0F2A` | `bg-background` | fundo da tela |
| `--foreground` | `#13201E` | `#F3F5FC` | `text-foreground`, `bg-foreground` | títulos, rótulos, **seleção** |
| `--card` | `#FFFFFF` | `#161C4A` | `bg-card` | cartão, campo, navegação |
| `--card-foreground` | `#13201E` | `#F3F5FC` | `text-card-foreground` | texto forte no cartão |
| `--popover` | `#FFFFFF` | `#161C4A` | `bg-popover` | diálogo |
| `--popover-foreground` | `#13201E` | `#F3F5FC` | `text-popover-foreground` | |
| `--primary` | `#84C32E` | `#84C32E` | `bg-primary` | **ação** (lima) |
| `--primary-foreground` | `#13201E` | `#13201E` | `text-primary-foreground` | texto sobre lima |
| `--primary-hover` | `#76B027` | `#76B027` | `bg-primary-hover` | |
| `--primary-press` | `#689B22` | `#689B22` | `bg-primary-press` | |
| `--secondary` | `#EEF0F8` | `#1F2760` | `bg-secondary` | preenchimento suave (uso interno do ZardUI) |
| `--secondary-foreground` | `#25337A` | `#F3F5FC` | `text-secondary-foreground` | |
| `--muted` | `#EEF0F1` | `#1F2760` | `bg-muted` | esqueleto, trilha |
| `--muted-foreground` | `#5E6C69` | `#A6ADD0` | `text-muted-foreground` | texto secundário |
| `--accent` | `#EEF0F8` | `#1F2760` | `bg-accent` | preenchimento de hover do ZardUI (não é o lima) |
| `--accent-foreground` | `#25337A` | `#F3F5FC` | `text-accent-foreground` | |
| `--destructive` | `#C23A2B` | `#C23A2B` | `bg-destructive` | botão de confirmação destrutiva |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | `text-destructive-foreground` | |
| `--destructive-hover` | `#A52E22` | `#A52E22` | `bg-destructive-hover` | |
| `--border` | `#E2E5E7` | `#2B3470` | `border-border` | borda decorativa (chip) |
| `--input` | `#7F8B88` | `#7C87C4` | `border-input` | **borda de controle** (campo, caixa, interruptor) |
| `--ring` | `#13201E` | `#F3F5FC` | — | anel de foco |
| `--ring-gap` | `#FFFFFF` | `#0B0F2A` | — | folga do anel de foco |
| `--radius` | `0.75rem` | — | — | base de raio do ZardUI (12px) |
| `--chart-1` … `--chart-5` | `#25337A` `#557F29` `#C26A12` `#1F6FB2` `#8E9ACF` | iguais | `bg-chart-N` | exigidos pelo mapeamento do ZardUI; sem uso no MVP |
| `--sidebar` | `#FFFFFF` | `#161C4A` | `bg-sidebar` | exigidos pelo mapeamento do ZardUI |
| `--sidebar-foreground` | `#13201E` | `#F3F5FC` | | |
| `--sidebar-primary` | `#13201E` | `#F3F5FC` | | |
| `--sidebar-primary-foreground` | `#FFFFFF` | `#0B0F2A` | | |
| `--sidebar-accent` | `#EEF0F8` | `#1F2760` | | |
| `--sidebar-accent-foreground` | `#25337A` | `#F3F5FC` | | |
| `--sidebar-border` | `#E2E5E7` | `#2B3470` | | |
| `--sidebar-ring` | `#13201E` | `#F3F5FC` | | |

### 2.2 Variáveis próprias do Faro

| Variável | Claro | Escuro | Classe | Papel |
|---|---|---|---|---|
| `--text` | `#33403D` | `#D8DCF0` | `text-text` | texto corrido |
| `--inset` | `#F7F8F8` | `#1F2760` | `bg-inset` | área interna do cartão (quadrado do ícone, mapa) |
| `--divider` | `#EEF0F1` | `#262E66` | `bg-divider`, `border-divider` | linha entre itens de lista |
| `--link` | `#25337A` | `#B8C0E2` | `text-link` | link de texto (sublinhado) |
| `--ink` | `#13201E` | `#13201E` | `bg-ink` | tinta **fixa**: botão tinta (dentro do cartão lima e em fluxos) |
| `--ink-foreground` | `#FFFFFF` | `#FFFFFF` | `text-ink-foreground` | |
| `--brand` | `#25337A` | `#25337A` | `bg-brand` | painel de marca, rodapé público |
| `--brand-foreground` | `#FFFFFF` | `#FFFFFF` | `text-brand-foreground` | |
| `--brand-muted` | `#DADFF0` | `#DADFF0` | `text-brand-muted` | texto secundário sobre navy |
| `--brand-deep` | `#32418C` | `#32418C` | `text-brand-deep` | focinho gigante sobre o rodapé navy (decorativo) |
| `--success-soft` | `#E4F4EA` | `#12392A` | `bg-success-soft` | selo "ativa", aviso de sucesso |
| `--success-foreground` | `#0F5E30` | `#7BD8A2` | `text-success-foreground` | |
| `--warning-soft` | `#FBF1DD` | `#3B2A10` | `bg-warning-soft` | selo "bloqueado", atalho do modo perdido |
| `--warning-foreground` | `#8A4A0C` | `#F2B866` | `text-warning-foreground` | |
| `--danger-soft` | `#FBE7E4` | `#4A1C17` | `bg-danger-soft` | selo "anulado", aviso de erro |
| `--danger-foreground` | `#A52E22` | `#F3A297` | `text-danger-foreground` | texto de erro, botão de texto destrutivo |
| `--neutral-soft` | `#EEF0F1` | `#1F2760` | `bg-neutral-soft` | selo neutro, aviso neutro |
| `--neutral-foreground` | `#33403D` | `#D8DCF0` | `text-neutral-foreground` | |
| `--disabled` | `#E2E5E7` | `#1F2760` | `bg-disabled` | botão desativado |
| `--disabled-foreground` | `#5E6C69` | `#A6ADD0` | `text-disabled-foreground` | |
| `--dot` | `#C23A2B` | `#F0705F` | `bg-dot` | ponto de "novo" no sino |
| `--amber` | `#C26A12` | `#C26A12` | `text-amber` | ícone e pino do modo perdido |
| `--lost` | `#A85A0E` | `#A85A0E` | `bg-lost` | bloco do modo perdido |
| `--lost-foreground` | `#FFFFFF` | `#FFFFFF` | `text-lost-foreground` | |
| `--photo` | `#E8E2D6` | `#2B3470` | `bg-photo` | fundo atrás da foto do pet |
| `--scrim` | `rgb(19 32 30 / 0.82)` | igual | `from-scrim` | véu escuro na base da capa do pet |
| `--toast` | `#080B20` | `#080B20` | `bg-toast` | aviso temporário (igual nos dois temas) |
| `--toast-foreground` | `#FFFFFF` | `#FFFFFF` | `text-toast-foreground` | |

### 2.3 Escala navy

`--color-navy-50` `#EEF0F8` · `100` `#DADFF0` · `200` `#B8C0E2` · `300` `#8E9ACF` · `400` `#6574B8` ·
`500` `#44549F` · `600` `#32418C` · `700` `#25337A` · `800` `#1A2459` · `900` `#0E1336` · `950` `#080B20`.

Os nomes `indigo-*` do Tailwind são redefinidos com os mesmos valores (decisão em
`docs/decisoes-pivo.md`: "os nomes `indigo-*` continuam existindo como apelidos"). **Código novo
usa os tokens semânticos (`bg-brand`, `text-link`) e, se precisar de um passo da escala,
`navy-*`. Não escreva `indigo-*` em código novo.**

### 2.4 Raio, sombra, fonte

| Token | Valor | Classe | Onde |
|---|---|---|---|
| `--radius-sm` | 8px | `rounded-sm` | detalhes |
| `--radius-md` | 12px | `rounded-md` | campo, célula do PIN, quadrado do ícone |
| `--radius-lg` | 12px | `rounded-lg` | padrão do ZardUI para controles |
| `--radius-card-sm` | 16px | `rounded-card-sm` | aviso, cartão pequeno |
| `--radius-xl` | 20px | `rounded-xl` | cartão, linha de lista |
| `--radius-2xl` | 24px | `rounded-2xl` | capa do pet, cartão lima, diálogo |
| `--radius-3xl` | 28px | `rounded-3xl` | cantos de cima da folha (celular) |
| `--radius-4xl` | 32px | `rounded-4xl` | cantos de cima da folha (tablet) |
| pílula | 9999px | `rounded-full` | botão, chip, selo, item de navegação |
| `--shadow-pop` | `0 12px 34px rgb(19 32 30 / .14), 0 3px 10px rgb(19 32 30 / .06)` | `shadow-pop` | **só** a barra inferior do celular e o aviso temporário |
| `--font-sans` | `'Inter', system-ui, sans-serif` | `font-sans` | texto |
| `--font-display` | `'Outfit', 'Inter', system-ui, sans-serif` | `font-display` | títulos, botões, números, código da tag |
| `--font-mono` | `ui-monospace, monospace` | `font-mono` | não usar; existe para não herdar o padrão do Tailwind |

Cartões não têm borda nem sombra. Não existe `--shadow-card`.

### 2.5 Tipografia (receitas de classe)

| Papel | Classes | Tamanho por largura (base / `md` / `xl`) |
|---|---|---|
| Display (uma por tela) | `font-display font-bold leading-none tracking-[-0.03em] text-foreground` | 40–46 / 52–64 / 44–72px, o da tela de referência |
| Headline (título de tela) | `font-display font-bold leading-[1.04] tracking-[-0.03em] text-foreground` | 19 (barra) ou 28–36 / 28 / 34px |
| Title (seção, cartão) | `font-display font-semibold leading-[1.15] tracking-[-0.01em] text-foreground` | 18–22px |
| Número de resumo | `font-display font-bold leading-[1.05] tracking-[-0.02em]` | 34–40px |
| Body | `font-sans text-text leading-[1.45]` | 15–17px (nunca menos de 15) |
| Label | `font-sans font-semibold text-foreground` | 13–14px |
| Legenda | `font-sans text-muted-foreground` | 13px |
| Botão | `font-display font-semibold` | 15 / 17 / 18px conforme o tamanho |
| Link de texto | `text-link font-semibold underline underline-offset-[3px]` | 14px |
| Código da tag | `font-display font-semibold tracking-[0.02em]` | 16px (nunca monoespaçada) |

Não há rótulo em caixa alta acima do título.

### 2.6 Larguras

| Nome | Prefixo | A partir de | Desenhado em |
|---|---|---|---|
| celular | (base) | 0 | 390px |
| tablet | `md:` | 768px | 768px |
| desktop | `xl:` | 1280px | 1440px |

São os valores padrão do Tailwind v4: não redefina `--breakpoint-*`. Não use `sm:`, `lg:` nem
`2xl:` para trocar layout. Toda tela tem de funcionar também em 320px, sem rolagem horizontal.

## 3. Conteúdo obrigatório de `src/styles.css`

O bloco abaixo é o arquivo inteiro. A linha `@import` do `zard.css` deve ficar **exatamente como
o `zard-cli init` a escreveu** (o caminho relativo pode variar; o esperado é o do bloco).

```css
@layer ng-icon, theme, base, components, utilities;
@import 'tailwindcss' source('.');
@import './app/shared/core/css/zard';
@plugin 'tailwindcss-animate';

@custom-variant dark (&:is(.dark *));

/* Fontes servidas pelo próprio domínio (arquivos em public/fonts). Variáveis: um arquivo cobre todos os pesos. */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/inter-latin-ext-wght-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/inter-latin-wght-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/outfit-latin-ext-wght-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/outfit-latin-wght-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
  color-scheme: light;
  --radius: 0.75rem;
  --background: #F7F8F8;
  --foreground: #13201E;
  --card: #FFFFFF;
  --card-foreground: #13201E;
  --popover: #FFFFFF;
  --popover-foreground: #13201E;
  --primary: #84C32E;
  --primary-foreground: #13201E;
  --primary-hover: #76B027;
  --primary-press: #689B22;
  --secondary: #EEF0F8;
  --secondary-foreground: #25337A;
  --muted: #EEF0F1;
  --muted-foreground: #5E6C69;
  --accent: #EEF0F8;
  --accent-foreground: #25337A;
  --destructive: #C23A2B;
  --destructive-foreground: #FFFFFF;
  --destructive-hover: #A52E22;
  --border: #E2E5E7;
  --input: #7F8B88;
  --ring: #13201E;
  --ring-gap: #FFFFFF;
  --chart-1: #25337A;
  --chart-2: #557F29;
  --chart-3: #C26A12;
  --chart-4: #1F6FB2;
  --chart-5: #8E9ACF;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #13201E;
  --sidebar-primary: #13201E;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EEF0F8;
  --sidebar-accent-foreground: #25337A;
  --sidebar-border: #E2E5E7;
  --sidebar-ring: #13201E;

  /* Faro: sem equivalente no shadcn */
  --text: #33403D;
  --inset: #F7F8F8;
  --divider: #EEF0F1;
  --link: #25337A;
  --ink: #13201E;
  --ink-foreground: #FFFFFF;
  --brand: #25337A;
  --brand-foreground: #FFFFFF;
  --brand-muted: #DADFF0;
  --brand-deep: #32418C;
  --success-soft: #E4F4EA;
  --success-foreground: #0F5E30;
  --warning-soft: #FBF1DD;
  --warning-foreground: #8A4A0C;
  --danger-soft: #FBE7E4;
  --danger-foreground: #A52E22;
  --neutral-soft: #EEF0F1;
  --neutral-foreground: #33403D;
  --disabled: #E2E5E7;
  --disabled-foreground: #5E6C69;
  --dot: #C23A2B;
  --amber: #C26A12;
  --lost: #A85A0E;
  --lost-foreground: #FFFFFF;
  --photo: #E8E2D6;
  --scrim: rgb(19 32 30 / 0.82);
  --toast: #080B20;
  --toast-foreground: #FFFFFF;
}

/* Só o app autenticado do tutor recebe esta classe (na casca, nunca em :root). */
.dark {
  color-scheme: dark;
  --background: #0B0F2A;
  --foreground: #F3F5FC;
  --card: #161C4A;
  --card-foreground: #F3F5FC;
  --popover: #161C4A;
  --popover-foreground: #F3F5FC;
  --secondary: #1F2760;
  --secondary-foreground: #F3F5FC;
  --muted: #1F2760;
  --muted-foreground: #A6ADD0;
  --accent: #1F2760;
  --accent-foreground: #F3F5FC;
  --border: #2B3470;
  --input: #7C87C4;
  --ring: #F3F5FC;
  --ring-gap: #0B0F2A;
  --sidebar: #161C4A;
  --sidebar-foreground: #F3F5FC;
  --sidebar-primary: #F3F5FC;
  --sidebar-primary-foreground: #0B0F2A;
  --sidebar-accent: #1F2760;
  --sidebar-accent-foreground: #F3F5FC;
  --sidebar-border: #2B3470;
  --sidebar-ring: #F3F5FC;
  --text: #D8DCF0;
  --inset: #1F2760;
  --divider: #262E66;
  --link: #B8C0E2;
  --success-soft: #12392A;
  --success-foreground: #7BD8A2;
  --warning-soft: #3B2A10;
  --warning-foreground: #F2B866;
  --danger-soft: #4A1C17;
  --danger-foreground: #F3A297;
  --neutral-soft: #1F2760;
  --neutral-foreground: #D8DCF0;
  --disabled: #1F2760;
  --disabled-foreground: #A6ADD0;
  --dot: #F0705F;
  --photo: #2B3470;
  /* --primary (lima), --ink, --brand, --lost, --amber, --destructive e --toast não mudam */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover);
  --color-primary-press: var(--primary-press);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-destructive-hover: var(--destructive-hover);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-text: var(--text);
  --color-inset: var(--inset);
  --color-divider: var(--divider);
  --color-link: var(--link);
  --color-ink: var(--ink);
  --color-ink-foreground: var(--ink-foreground);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-muted: var(--brand-muted);
  --color-brand-deep: var(--brand-deep);
  --color-success-soft: var(--success-soft);
  --color-success-foreground: var(--success-foreground);
  --color-warning-soft: var(--warning-soft);
  --color-warning-foreground: var(--warning-foreground);
  --color-danger-soft: var(--danger-soft);
  --color-danger-foreground: var(--danger-foreground);
  --color-neutral-soft: var(--neutral-soft);
  --color-neutral-foreground: var(--neutral-foreground);
  --color-disabled: var(--disabled);
  --color-disabled-foreground: var(--disabled-foreground);
  --color-dot: var(--dot);
  --color-amber: var(--amber);
  --color-lost: var(--lost);
  --color-lost-foreground: var(--lost-foreground);
  --color-photo: var(--photo);
  --color-scrim: var(--scrim);
  --color-toast: var(--toast);
  --color-toast-foreground: var(--toast-foreground);

  /* Escala navy (canônica) */
  --color-navy-50: #EEF0F8;
  --color-navy-100: #DADFF0;
  --color-navy-200: #B8C0E2;
  --color-navy-300: #8E9ACF;
  --color-navy-400: #6574B8;
  --color-navy-500: #44549F;
  --color-navy-600: #32418C;
  --color-navy-700: #25337A;
  --color-navy-800: #1A2459;
  --color-navy-900: #0E1336;
  --color-navy-950: #080B20;
  /* indigo-* vira apelido do navy (docs/decisoes-pivo.md). Não usar em código novo. */
  --color-indigo-50: #EEF0F8;
  --color-indigo-100: #DADFF0;
  --color-indigo-200: #B8C0E2;
  --color-indigo-300: #8E9ACF;
  --color-indigo-400: #6574B8;
  --color-indigo-500: #44549F;
  --color-indigo-600: #32418C;
  --color-indigo-700: #25337A;
  --color-indigo-800: #1A2459;
  --color-indigo-900: #0E1336;
  --color-indigo-950: #080B20;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 12px;
  --radius-card-sm: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Outfit', 'Inter', system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;

  --shadow-pop: 0 12px 34px rgb(19 32 30 / 0.14), 0 3px 10px rgb(19 32 30 / 0.06);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background font-sans text-text antialiased;
  }
  h1,
  h2,
  h3 {
    @apply font-display text-foreground;
  }
  /* Foco: anel de 2px na cor --ring com folga de 2px. Um único mecanismo, para todo elemento. */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px var(--ring-gap);
  }
  /* Alvos de foco programático (painel de diálogo, <main>) não são paradas de tabulação: sem anel. */
  [tabindex='-1']:focus-visible {
    outline: none;
    box-shadow: none;
  }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

Notas sobre o bloco:

- `source('.')` limita a varredura de classes do Tailwind à pasta `src/`. Sem isso o Tailwind lê
  também `docs/` e `specs/`, que citam centenas de classes em texto, e gera CSS que ninguém usa.
  **Canário**: a classe `outline-[#0FA12E]` aparece só nesta linha do repositório. Se a string
  `0FA12E` existir no CSS gerado em `dist/`, a restrição não está funcionando.
- `body` fica **fora** de `.dark`: o fundo da página é sempre claro. A casca do tutor pinta o
  próprio fundo.
- Se `src/app/shared/core/css/zard.css` (copiado pelo `zard-cli`) declarar alguma das variáveis
  da seção 2, **apague a declaração de lá** e registre no `execution-log.md`. Aquele arquivo pode
  conter regras de apoio dos componentes, mas não tokens.
- A regra de foco usa `box-shadow` para a folga. Um elemento focável que precise de sombra
  própria (hoje não há nenhum) terá de combinar as duas sombras na mesma declaração.

## 4. Foco, toque e movimento

- **Foco**: o anel vem da regra global `:focus-visible` acima. **Nenhum componente usa as classes
  `ring-*` do Tailwind nem `outline-none`/`outline-hidden` para foco.** Ao copiar um componente do
  ZardUI, remova `focus-visible:ring-*`, `focus-visible:border-ring`, `outline-none`,
  `outline-hidden` e `aria-invalid:ring-*` das variantes. Campo inválido usa
  `aria-invalid:border-destructive`. Elementos com `tabindex="-1"` (painel de diálogo, `<main>`)
  recebem foco por código e não mostram anel: isso também já está na regra global.
- **Toque**: todo alvo interativo tem pelo menos 44 × 44px de área clicável. Controle visualmente
  menor (interruptor de 32px, chip de 38px, botão `sm` de 36px, link de texto) estende a área com
  `relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']` (ajuste o
  valor para chegar a 44px) ou com `inline-flex min-h-11 items-center`.
- **Movimento**: transições de cor e borda em `duration-150`. A regra global acima neutraliza
  animações sob `prefers-reduced-motion`.

## 5. Pares de contraste obrigatórios

Calculado em 2026-11-21 com a fórmula da WCAG 2.1. O script `scripts/ui-checks/tokens.mjs` refaz a
conta a partir de `src/styles.css` e falha se algum par ficar abaixo do mínimo.

**Texto, mínimo 4,5:1**

| Par (frente sobre fundo) | Claro | Escuro |
|---|---|---|
| `foreground` / `background` | 15,75 | 17,27 |
| `foreground` / `card` | 16,76 | 14,84 |
| `foreground` / `inset` | 15,75 | 12,70 |
| `text` / `background` | 10,17 | 13,81 |
| `text` / `card` | 10,82 | 11,87 |
| `text` / `inset` | 10,17 | 10,16 |
| `muted-foreground` / `background` | 5,16 | 8,52 |
| `muted-foreground` / `card` | 5,49 | 7,32 |
| `muted-foreground` / `muted` | 4,80 | 6,27 |
| `muted-foreground` / `inset` | 5,16 | 6,27 |
| `primary-foreground` / `primary` | 7,84 | 7,84 |
| `primary-foreground` / `primary-hover` | 6,39 | 6,39 |
| `primary-foreground` / `primary-press` | 5,03 | 5,03 |
| `background` / `foreground` (seleção) | 15,75 | 17,27 |
| `card` / `foreground` | 16,76 | 14,84 |
| `ink-foreground` / `ink` | 16,76 | 16,76 |
| `secondary-foreground` / `secondary` | 10,07 | 12,70 |
| `accent-foreground` / `accent` | 10,07 | 12,70 |
| `destructive-foreground` / `destructive` | 5,34 | 5,34 |
| `destructive-foreground` / `destructive-hover` | 6,97 | 6,97 |
| `link` / `background` | 10,77 | 10,46 |
| `link` / `card` | 11,46 | 8,99 |
| `success-foreground` / `success-soft` | 6,92 | 7,41 |
| `success-foreground` / `background` | 7,41 | 10,92 |
| `success-foreground` / `card` | 7,88 | 9,38 |
| `warning-foreground` / `warning-soft` | 6,11 | 7,76 |
| `warning-foreground` / `card` | 6,85 | 9,10 |
| `danger-foreground` / `danger-soft` | 5,86 | 7,09 |
| `danger-foreground` / `card` | 6,97 | 8,03 |
| `danger-foreground` / `background` | 6,55 | 9,34 |
| `neutral-foreground` / `neutral-soft` | 9,46 | 10,16 |
| `lost-foreground` / `lost` | 5,08 | 5,08 |
| `brand-foreground` / `brand` | 11,46 | 11,46 |
| `brand-muted` / `brand` | 8,62 | 8,62 |
| `primary` / `brand` (código da tag no rodapé) | 5,36 | 5,36 |
| `toast-foreground` / `toast` | 19,46 | 19,46 |
| `primary` / `toast` (ação do aviso) | 9,11 | 9,11 |

**Controles e ícones, mínimo 3:1**

| Par | Claro | Escuro |
|---|---|---|
| `input` / `card` | 3,53 | 4,71 |
| `input` / `background` | 3,32 | 5,48 |
| `ring` / `background` | 15,75 | 17,27 |
| `ring` / `card` | 16,76 | 14,84 |
| `amber` / `card` | 3,91 | 4,13 |
| `amber` / `warning-soft` | 3,49 | 3,52 |
| `amber` / `background` | 3,68 | 4,81 |
| `dot` / `card` | 5,34 | 5,53 |
| `ink` / `primary` (botão tinta sobre o cartão lima) | 7,84 | 7,84 |

**Fora da regra, de propósito** (não entram no script): `border` sobre `card` (borda decorativa,
1,27:1), `brand-deep` sobre `brand` (focinho decorativo), `disabled-foreground` sobre `disabled`
no claro (4,34:1; controle desativado é isento pela WCAG) e lima sobre fundo claro (2,1:1), que
por isso é proibido como texto, marca pequena ou seleção.

## 6. O que saiu e não pode voltar

`#3A4FD6` e a escala índigo antiga · `#7FBF3F` · Poppins · JetBrains Mono · as variáveis
`--surface-0`, `--app`, `--text-strong`, `--r-sm`/`--r-md`/`--r-lg`, `--tap`, `--indigo-*`,
`--whatsapp*`, `--info*`, `--shadow-card` · a classe `.faro-dark` · as classes `.f-*` e `.t-*` de
`faro-ds.css` · qualquer classe ou import de PrimeNG.

## 7. Como outra spec acrescenta um token

1. Declarar a variável em `:root` (e em `.dark` se o valor mudar) e mapear em `@theme inline`,
   neste mesmo arquivo.
2. Acrescentar a linha na tabela da seção 2 e, se for cor de texto ou de controle, o par na seção 5
   e no script `scripts/ui-checks/tokens.mjs`.
3. Rodar `npm run check:tokens`.
