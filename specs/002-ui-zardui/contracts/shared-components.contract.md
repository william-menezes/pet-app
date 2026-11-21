# Contrato: componentes compartilhados

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21
**Fontes**: `DESIGN.md`, `docs/zardui-faro.md` §2–§4, `design/telas-v2-gerador/lib.js` (funções
`btn`, `field`, `toggle`, `row`, `chip`, `segmented`, `cells`, `badge`, `steps`, `note`,
`infoCard`, `brandPanel`, `focinho`), `design/telas-v2-gerador/screens-app.js` (`hero`,
`limeCard`, `tile`). Valores de cor, raio e fonte: `design-tokens.contract.md`.

Dois tipos de componente moram em `src/app/shared/components/`:

- **ZardUI copiado** (`src/app/shared/components/<nome>/`): o `zard-cli` copia o código; o Faro
  edita as variantes no próprio arquivo. Seletor com prefixo `z-`. **Este contrato fixa o
  resultado (aparência, estados, acessibilidade). A API (seletor exato, nomes dos `input()`) é a
  do código copiado: leia `<nome>.component.ts` e `<nome>.variants.ts` antes de usar.**
- **Próprio do Faro** (`src/app/shared/components/faro/<nome>/`): não existe no ZardUI. Seletor
  com prefixo `app-`. Este contrato fixa a API inteira.

Regra de escolha, quando outra spec precisar de algo novo: se o ZardUI tem o componente, copie com
o `zard-cli` e edite; só crie um componente próprio para o que é marca ou layout do Faro. Não crie
embrulho próprio em volta de um componente do ZardUI.

## 1. Regras para todo componente

1. `standalone`, estado com `signal`/`input()`/`model()`/`output()`, sem `any`,
   `ChangeDetectionStrategy.OnPush`.
2. Estilo só com classes do Tailwind e tokens. Sem `styleUrl`, sem `styles`, sem `style=""` com
   cor. Nenhum hexadecimal (exceção: `google-glyph.ts`).
3. Renderiza no servidor sem erro: nada de `window`, `document`, `localStorage` ou `matchMedia`
   fora de `afterNextRender`/`isPlatformBrowser`. Componentes próprios do Faro não usam
   `localStorage` (o ESLint proíbe em `shared/`).
4. Texto fixo dentro do componente (rótulos de acessibilidade incluídos) é marcado para tradução:
   `i18n`, `i18n-aria-label` no template; `$localize` no TypeScript. Texto variável entra por
   `input()`.
5. Ícone decorativo tem `aria-hidden="true"`. Ícone que é o controle inteiro: `aria-label` no
   controle.
6. Todo alvo de toque tem 44 × 44px de área (ver `design-tokens.contract.md` §4).
7. O foco é o da regra global. Não escreva classes de foco.
8. `data-testid="<feature>-<elemento>"` só onde este contrato ou o de cascas pede.
9. Componentes próprios do Faro importam só `@angular/*`, `@ng-icons/core`, outros componentes de
   `shared/` e `shared/icons`. **Nunca** `core/auth`, `core/supabase` nem `features/*`.

## 2. Ícones (`src/app/shared/icons/faro-icons.ts`)

Boxicons v3 (`@boxicons/js` 1.0.1) registrados no `@ng-icons/core` 34.x sob nomes do Faro.
`provideIcons(faroIcons)` em `src/app/app.config.ts`. Uso: `<ng-icon name="pin" size="20" aria-hidden="true" />`.

```ts
import { createSvgString, /* ...glifos */ } from '@boxicons/js';

const svg = (icon: Parameters<typeof createSvgString>[0], o: Parameters<typeof createSvgString>[1] = {}) =>
  createSvgString(icon, o).replace(/ width="\d+" height="\d+"/, ''); // o ng-icon define o tamanho
```

| Nome do Faro | Export do `@boxicons/js` | Pacote | Uso |
|---|---|---|---|
| `pin` | `Location` | basic | localização, scan no mapa |
| `warn` | `AlertTriangle` | basic | modo perdido, cuidado |
| `back` | `ChevronLeft` | basic | voltar |
| `chev` | `ChevronRight` | basic | seta de linha de lista |
| `down` | `ChevronDown` | basic | abrir seleção |
| `close` | `X` | basic | fechar |
| `check` | `Check` | basic | confirmação, caixa marcada |
| `plus` | `Plus` | basic | adicionar |
| `clock` | `Clock` | basic | histórico, auditoria |
| `info` | `InfoCircle` | basic | aviso neutro |
| `eye` | `Eye` | basic | mostrar senha, prévia |
| `eyeOff` | `EyeSlash` | basic | ocultar senha |
| `lock` | `Lock` | basic | segurança |
| `bell` | `Bell` | basic | notificações |
| `home` | `Home` | basic | Início |
| `paw` | `PawPrint` | basic | Pets, pet sem foto |
| `scan` | `Scan` | basic | Scans |
| `user` | `User` | basic | Conta |
| `edit` | `Edit` | basic | editar |
| `qr` | `Qr` | basic | código da tag |
| `share` | `Share` | basic | compartilhar |
| `print` | `Printer` | basic | imprimir etiquetas |
| `camera` | `Camera` | basic | foto do pet |
| `search` | `Search` | basic | busca |
| `tag` | `Tag` | basic | tag |
| `list` | `ListUl` | basic | lotes |
| `block` | `Block` | basic | bloquear código |
| `minus` | `Minus` | basic | uso interno (separador) |
| `loader` | `LoaderLines` | basic | carregando |
| `alert` | `AlertCircle` | basic | aviso de erro |
| `checkCircle` | `CheckCircle` | basic | aviso de sucesso |
| `whats` | `Whatsapp` | **brands** (`{ pack: 'brands' }`) | botão do WhatsApp (ícone oficial) |

- Os 32 nomes acima foram conferidos contra `@boxicons/js@1.0.1` em 2026-11-21: todos os exports
  existem. Exporte também `export type FaroIconName = keyof typeof faroIcons;`.
- Ícones de funcionalidades do roadmap (`vacina`, `consulta`, `peso`, `ai`, `star`…), listados em
  `docs/zardui-faro.md` §4, **não entram** (Princípio VI).
- Ícone novo: escolher em boxicons.com (filtro Free, estilo Basic), acrescentar o import e uma
  linha nesta tabela.
- Os componentes do ZardUI chegam importando `@ng-icons/lucide`. Troque cada símbolo pelo nome do
  Faro equivalente (`lucideCheck` → `check`, `lucideX` → `close`, `lucideChevronDown` → `down`,
  `lucideChevronRight` → `chev`, `lucideLoaderCircle` → `loader`, `lucideMinus` → `minus`,
  `lucideEye` → `eye`, `lucideEyeOff` → `eyeOff`, `lucideCircleAlert`/`lucideInfo` → `alert`/`info`,
  `lucideCircleCheck` → `checkCircle`), remova o `provideIcons`/`viewProviders` local do
  componente e, no fim, desinstale `@ng-icons/lucide`.
- O "G" do Google **não** é Boxicons: é `app-google-glyph` (§5.4).

## 3. Componentes do ZardUI: lista e edições

Comando (versão fixa, ver `research.md` §R2):

```bash
npx zard-cli@1.12.0 add button input textarea field checkbox switch toggle toggle-group badge alert alert-dialog card item empty sonner spinner skeleton input-otp --yes
```

O CLI traz sozinho as dependências de registro (por exemplo `input-group`). **Não rode
`add dark-mode`, `add sidebar`, `add typeset` nem `add --all`.**

Edições comuns a todos, logo depois de copiar:

- foco: remover `focus-visible:ring-*`, `focus-visible:border-ring`, `outline-none`,
  `outline-hidden`, `aria-invalid:ring-*` (o foco é global);
- ícones Lucide → nomes do Faro (§2);
- nenhuma sombra em cartão; nenhuma cor fora dos tokens.

### 3.1 Botão (`button`)

Base (substitui a base do ZardUI):

```
inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 select-none cursor-pointer
rounded-full border-[1.5px] border-transparent font-display font-semibold
transition-colors duration-150
disabled:pointer-events-none disabled:border-transparent disabled:bg-disabled disabled:text-disabled-foreground
[&_ng-icon]:shrink-0
```

| `zType` | Classes | Uso |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press` | **ação principal** (lima). Uma por tela |
| `outline` | `bg-card border-foreground text-foreground hover:bg-background active:bg-muted` | ação secundária; botão do Google |
| `ink` | `bg-ink text-ink-foreground hover:bg-ink/90 active:bg-ink/80` | ação dentro do cartão lima; ação escura em fluxo |
| `ghost` | `bg-transparent text-foreground hover:bg-foreground/5 active:bg-foreground/10` | saída do fluxo ("Agora não") |
| `danger` | `bg-transparent text-danger-foreground hover:bg-danger-soft active:bg-danger-soft` | ação destrutiva em texto ("Desvincular tag") |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive-hover` | **só** o botão de confirmar dentro de um diálogo destrutivo |
| `link` | `h-auto min-h-11 rounded-none border-0 px-0 font-sans text-link underline underline-offset-[3px]` | link de texto com cara de botão |
| `secondary` | `bg-muted text-foreground hover:bg-border` | não usar em telas; existe porque componentes internos do ZardUI o referenciam |

| `zSize` | Classes | Altura | Uso |
|---|---|---|---|
| `sm` | `relative h-9 gap-1.5 px-3.5 text-sm before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']` | 36 (área 44) | linha densa; nunca a ação principal |
| `md` | `h-11 px-[18px] text-[15px]` | 44 | botão tinta do cartão lima; saídas |
| `default` | `h-12 px-[22px] text-base` | 48 | ação comum |
| `lg` | `h-14 px-5 text-[17px]` | 56 | ação principal no pé da tela |
| `rescue` | `h-15 w-full gap-2.5 px-6 text-lg md:h-16 md:text-xl` | 60 (64 em `md`+) | botão da página de resgate |
| `icon` | `size-11 rounded-full p-0` | 44 × 44 | botão só com ícone; `aria-label` obrigatório |

- Variantes removidas em relação a `docs/zardui-faro.md` §2: `accent` e `whatsapp` (eram iguais a
  `default`). O botão do WhatsApp é `zType="default"` com `<ng-icon name="whats" />` antes do texto.
- O botão do Google é `zType="outline"` com `<app-google-glyph />` antes do texto.
- Estender os tipos `ZardButtonTypeVariants`/`ZardButtonSizeVariants` (derivam do `cva`).
- Carregando: usar o estado de carregamento do próprio componente com o ícone `loader`
  (`animate-spin`), `aria-busy="true"` e o botão desativado.
- Rótulo é verbo + objeto ("Ativar minha tag"). Nunca "OK".

### 3.2 Campo (`field` + `input` + `textarea`)

| Parte | Resultado |
|---|---|
| Rótulo | acima do campo, fora da caixa; `text-sm font-semibold text-foreground`; `for` ligado ao `id` do campo; 6px de distância |
| Campo | `h-[54px] w-full rounded-md border-[1.5px] border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground` |
| Campo inválido | `aria-invalid="true"` e `aria-invalid:border-destructive` |
| Campo desativado | `disabled:bg-disabled disabled:text-disabled-foreground` |
| Área de texto | `min-h-[96px] resize-none py-3.5 leading-[1.45]`, mesmo raio e borda |
| Ajuda | abaixo; `text-[13px] text-muted-foreground` |
| Erro | abaixo; `text-[13px] font-semibold text-danger-foreground`; tem `id` e o campo aponta para ele com `aria-describedby` |
| Sucesso | abaixo; `text-[13px] font-semibold text-success-foreground` com o ícone `check` de 16px |

`text-base` (16px) no campo é obrigatório: evita o zoom do iOS ao focar.

**Campo de senha** (padrão, não é componente): `div.relative` em volta; o campo ganha `pr-[52px]`;
um botão `zType="ghost" zSize="icon"` em `absolute right-[5px] top-[5px]` alterna `type` entre
`password` e `text`, troca o ícone (`eye`/`eyeOff`, `text-muted-foreground`), tem `type="button"`,
`aria-pressed` e `aria-label` "Mostrar senha"/"Ocultar senha".

### 3.3 Caixa (`checkbox`) e interruptor (`switch`)

| Componente | Desligado | Ligado |
|---|---|---|
| Caixa | 20 × 20px, `rounded-[6px] border-[1.5px] border-input bg-card` | `bg-foreground border-foreground text-background` com o ícone `check` |
| Interruptor | 52 × 32px, `rounded-full border-[1.5px] border-input bg-transparent`; bolinha de 22px em `bg-input` | `bg-foreground border-foreground`; bolinha em `bg-background` |

- A linha da caixa (caixa + rótulo) tem `min-h-11`, `gap-2.5`, `text-sm text-foreground`; o rótulo
  é clicável.
- O interruptor tem `role="switch"`, `aria-checked` e nome acessível; a área de toque chega a 44px
  de altura.

### 3.4 Selo (`badge`), chip (`toggle`) e segmentado (`toggle-group`)

**Selo**: `inline-flex items-center rounded-full font-semibold whitespace-nowrap`, sem borda.

| `zType` | Classes |
|---|---|
| `neutral` (padrão) | `bg-neutral-soft text-neutral-foreground` |
| `success` | `bg-success-soft text-success-foreground` |
| `warning` | `bg-warning-soft text-warning-foreground` |
| `danger` | `bg-danger-soft text-danger-foreground` |
| `ink` | `bg-foreground text-background` |
| `outline` | `border border-border bg-card text-foreground` (etiqueta de temperamento) |

| `zSize` | Classes |
|---|---|
| `default` | `h-6 px-2.5 text-xs` (24px) |
| `lg` | `h-8 px-3 text-[13px]` (32px) |

**Chip** (`toggle`): `h-[38px] rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap`
com área de toque de 44px. Solto: `border-border bg-card text-foreground`. Escolhido
(`aria-pressed="true"`): `border-foreground bg-foreground text-background`.

**Segmentado** (`toggle-group`, seleção única): trilho `grid gap-1 rounded-full bg-card p-1` com
colunas iguais; cada opção `h-10 rounded-full text-sm font-semibold`; solta `text-foreground` sem
fundo; escolhida `bg-foreground text-background`. O grupo tem `aria-label`. Sempre há uma opção
escolhida.

### 3.5 Cartão (`card`), linha de lista (`item`) e estado vazio (`empty`)

- **Cartão**: `rounded-xl bg-card p-4`. Sem borda, sem sombra. Não se aninha cartão em cartão.
- **Grupo de linhas**: um cartão (`rounded-xl bg-card`, sem padding) com as linhas dentro. Entre
  uma linha e outra, uma linha de 1px em `divider`, recuada 14px de cada lado.
- **Linha** (`item`): `flex items-center gap-3 px-3.5 py-3 min-h-11`. Ordem: `app-icon-tile`
  (opcional), título `text-[15px] font-semibold text-foreground`, subtítulo
  `text-[13px] leading-[1.35] text-muted-foreground`, e **um único** item à direita (seta, selo ou
  interruptor). Quando a linha é um link e não há item à direita, mostra o ícone `chev` de 20px em
  `text-muted-foreground`.
- **Estado vazio**: coluna centralizada com título (receita Title), uma frase e **uma ação** que
  leva ao próximo passo. Nunca termina sem ação.

### 3.6 Aviso (`alert`), aviso temporário (`sonner`) e diálogo (`alert-dialog`)

**Aviso**: `flex items-start gap-3 rounded-card-sm px-3.5 py-3 text-sm leading-[1.45]`, sem borda.

| `zType` | Classes | Ícone | Papel ARIA |
|---|---|---|---|
| `neutral` (padrão) | `bg-neutral-soft text-neutral-foreground` | `info` | `role="status"` |
| `success` | `bg-success-soft text-success-foreground` | `checkCircle` | `role="status"` |
| `danger` | `bg-danger-soft text-danger-foreground` | `alert` | `role="alert"` |

Não existe aviso âmbar nem azul: âmbar é do modo perdido.

**Aviso temporário**: `bg-toast text-toast-foreground rounded-card-sm shadow-pop px-4 py-3 text-sm`;
ação em `bg-primary text-primary-foreground rounded-full`. Posição `top-center`. Mesma aparência
nos dois temas. O `<z-toaster>` é montado **pela tela ou casca que precisa dele** (login, app do
tutor, admin). **Nunca em `src/app/app.html`**, para não entrar no pacote da página pública.

**Diálogo**: fundo `bg-ink/50`; cartão `w-[calc(100vw-2rem)] max-w-[420px] rounded-2xl bg-popover p-6
text-popover-foreground`; título receita Title 20px; texto 15px em `text-text`. Botões: em coluna
no celular (o de confirmar primeiro, largura total), em linha alinhada à direita em `md`+.
Confirmação destrutiva: `zType="destructive"`; cancelar: `zType="ghost"`. **Proibido na página
pública.**

### 3.7 Carregando (`spinner`, `skeleton`) e células de código (`input-otp`)

- **Spinner**: ícone `loader` com `animate-spin`, em `text-foreground`. Sempre com texto ao lado ou
  dentro de um elemento com `role="status"` e `aria-label`.
- **Esqueleto**: `animate-pulse rounded-md bg-muted`.
- **Células de código** (PIN de ativação e código por SMS): 6 posições em
  `grid grid-cols-6 gap-2 max-w-[368px]`; cada célula `h-[60px] rounded-md bg-card text-center
  font-display text-[26px] font-semibold text-foreground uppercase`. Borda: vazia
  `border-[1.5px] border-input`; preenchida `border-[1.5px] border-foreground`; ativa
  `border-[2.5px] border-foreground`.
  - Modo **numérico** (código por SMS): `inputmode="numeric"`, `autocomplete="one-time-code"`,
    só dígitos.
  - Modo **alfanumérico** (PIN, 6 caracteres Crockford): aceita `0-9` e `A-Z`,
    `autocapitalize="characters"`. Se o componente copiado só aceitar dígitos, edite o padrão no
    próprio arquivo copiado.
  - Nome acessível obrigatório (por exemplo "Código de 6 dígitos").
  - **Sem normalização aqui** (`O→0`, `I→1`, `L→1`): isso é de `core/tag-code`, da spec 003.

## 4. Marca: um arquivo para trocar o logo

`src/app/shared/components/faro/logo/brand-assets.ts` é o **único** lugar que conhece os arquivos
e as medidas do logo:

```ts
/** Arquivos do wordmark. Trocar o logo = substituir os arquivos em public/logos/ ou editar só este arquivo. */
export const LOGO = {
  onLight: '/logos/logo-full-light.svg', // letras navy, focinho lima
  onDark: '/logos/logo-full-dark.svg',   // letras brancas, focinho lima
  width: 770,                            // medidas do viewBox, para calcular a largura
  height: 290,
} as const;

/** Focinho (símbolo). `path` é o atributo `d` de public/logos/logo-compact.svg. */
export const FOCINHO = {
  viewBox: '20 20 234 207',
  path: '…',
} as const;
```

- Se o William entregar arquivos **com os mesmos nomes e proporção**: basta sobrescrever
  `public/logos/logo-full-light.svg` e `logo-full-dark.svg`. Nenhuma linha de código muda.
- Se o nome ou a proporção mudarem: edita-se **só** `brand-assets.ts`.
- Nenhum outro arquivo de `src/` contém `/logos/` ou o desenho do focinho. (O gerador de ícones
  em `scripts/` lê `public/logos/logo-compact.svg` direto.)
- `logo-compact2.svg` e `logo-full-light2.svg` (versões para fundo lima) continuam em
  `public/logos/`, sem uso no código.

## 5. Componentes próprios do Faro (`src/app/shared/components/faro/`)

### 5.1 `app-logo` — `logo/logo.ts`

| Input | Tipo | Padrão | |
|---|---|---|---|
| `tone` | `'on-light' \| 'on-dark'` | `'on-light'` | qual arquivo usar |
| `height` | `number` | `48` | altura em px; a largura é `round(height × LOGO.width / LOGO.height)` |

Renderiza `<img [src] alt="Faro" [attr.width] [attr.height] decoding="async" class="block max-w-none">`.
Alturas usadas nas telas: 40, 44, 48, 52, 60, 64.

### 5.2 `app-focinho` — `focinho/focinho.ts`

| Input | Tipo | Padrão | |
|---|---|---|---|
| `label` | `string \| null` | `null` | com texto: `role="img"` e `aria-label`; sem texto: `aria-hidden="true"` |

`<svg [attr.viewBox]="FOCINHO.viewBox" fill="currentColor" class="block h-auto w-full"><path fill-rule="evenodd" clip-rule="evenodd" [attr.d]="FOCINHO.path" /></svg>`.
Tamanho e cor vêm de classes no elemento hospedeiro (`class="w-[270px] text-primary"`).
Proporção 234:207.

**Focinho gigante**: uma vez por tela, só em momento de marca, sangrando para fora da borda
(o pai tem `overflow-hidden`), nunca atrás de texto corrido, nunca lima sobre lima. Lima
(`text-primary`) sobre navy e sobre o fundo do login; `text-brand-deep` sobre o rodapé navy.

### 5.3 `app-brand-panel` — `brand-panel/brand-panel.ts`

Painel navy com o focinho gigante, o wordmark de letras brancas e, no desktop, a tagline.

| Input | Tipo | Padrão | |
|---|---|---|---|
| `variant` | `'page' \| 'flow'` | `'page'` | `page`: metade da tela (login, páginas públicas). `flow`: 560px (fluxos) |
| `headline` | `string[]` | `[]` | linhas da frase; cada item vira uma linha |
| `sub` | `string` | `''` | frase de apoio |

Hospedeiro: `relative flex flex-col overflow-hidden bg-brand text-brand-foreground`. O **pai**
define o tamanho (altura da faixa no celular e no tablet; largura no desktop).

| | base (faixa de 230px) | `md` (faixa de 330px) | `xl`, `page` | `xl`, `flow` |
|---|---|---|---|---|
| Padding | 20px | 28px 32px | 48px 56px 56px | 48px 56px 56px |
| Focinho (lima), largura | 300px | 480px | 640px | 560px |
| Focinho, `right` / `top` | −70 / −40px | −110 / −80px | −190 / −130px | −180 / −120px |
| Logo (`on-dark`), altura | 52px | 60px | 60px | 60px |
| Frase | oculta | oculta | 72px, `leading-none` | 56px, `leading-none` |
| Apoio | oculto | oculto | 18px, `max-w-[420px]`, `text-brand-muted`, 18px abaixo | igual |

A frase usa a receita Display em branco e fica no pé do painel (`mt-auto`). É um `<p>`, não um
título: o `h1` da tela está no conteúdo. Textos padrão, exportados de `brand-panel/brand-copy.ts`
com `$localize`: linhas `['O caminho', 'de volta', 'para casa.']` e apoio
`'A tag com QR Code que ajuda quem achou o seu pet a falar com você.'`.

### 5.4 `app-google-glyph` — `google-glyph/google-glyph.ts`

SVG de 20 × 20px, `aria-hidden="true"`, `viewBox="0 0 48 48"`, com as quatro cores oficiais. É o
único arquivo de `src/app` com hexadecimal. Caminhos (copiar exatamente):

```html
<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
```

O "G" que está hoje em `login.html` usa cores que não são as oficiais; é substituído por este.

### 5.5 `app-brand-mark` — `brand-mark/brand-mark.ts`

Círculo branco com o focinho lima, usado no canto de cima da foto nas páginas públicas.

| Input | Tipo | Padrão |
|---|---|---|
| `size` | `44 \| 52 \| 56` | `44` |

`flex items-center justify-center rounded-full bg-white`; dentro, `app-focinho` com
`label="Faro"`, `text-primary` e 60% da largura do círculo.

### 5.6 `app-icon-tile` — `icon-tile/icon-tile.ts`

| Input | Tipo | Padrão |
|---|---|---|
| `icon` | `FaroIconName` | obrigatório |
| `tone` | `'neutral' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |

`flex size-10 shrink-0 items-center justify-center rounded-md`; `neutral`: `bg-inset text-foreground`;
os outros: `bg-<tom>-soft text-<tom>-foreground`. Ícone de 20px, `aria-hidden`.

### 5.7 `app-info-card` — `info-card/info-card.ts`

| Input | Tipo | |
|---|---|---|
| `icon` | `FaroIconName` | obrigatório |
| `title` | `string` | obrigatório |

Conteúdo projetado: o texto. `flex items-start gap-3 rounded-xl bg-card px-4 py-3.5`; título
`text-[15px] font-semibold text-foreground`; texto `text-sm leading-[1.45] text-text`.

### 5.8 `app-note` — `note/note.ts`

| Input | Tipo | |
|---|---|---|
| `icon` | `FaroIconName` | obrigatório |

Conteúdo projetado: o texto. `flex items-start gap-2.5 text-[13px] leading-[1.45] text-muted-foreground`;
ícone de 18px.

### 5.9 `app-stat-tile` — `stat-tile/stat-tile.ts`

| Input | Tipo | Padrão | |
|---|---|---|---|
| `label` | `string` | obrigatório | "Scans este mês" |
| `value` | `string` | obrigatório | "3", "5 de 7" |
| `caption` | `string` | `''` | "O último foi hoje" |
| `link` | `string \| null` | `null` | com link, o cartão inteiro é um `<a [routerLink]>` |

`flex flex-col gap-1 rounded-xl bg-card p-4`; rótulo e legenda `text-[13px] text-muted-foreground`;
valor na receita "Número de resumo", 38px (`xl:text-[40px]`), `text-foreground`.

### 5.10 `app-steps` — `steps/steps.ts`

| Input | Tipo | |
|---|---|---|
| `current` | `number` | passo atual (começa em 1) |
| `total` | `number` | total de passos |

Barras: `flex gap-1.5`, cada uma `h-[5px] flex-1 rounded-full`; feitas (até `current`)
`bg-foreground`, as outras `bg-border`. Abaixo, o texto "Passo N de T" em
`text-[13px] text-muted-foreground`. As barras têm `aria-hidden="true"`; quem lê o texto é o
leitor de tela. **A barra é tinta, não lima.**

### 5.11 `app-pet-hero` — `pet-hero/pet-hero.ts`

Capa com a foto do pet.

| Input | Tipo | Padrão | |
|---|---|---|---|
| `name` | `string` | obrigatório | |
| `subtitle` | `string` | `''` | "Tag ativa · 7K3M-Q9XA-C" |
| `photoUrl` | `string \| null` | `null` | sem foto: fundo `bg-photo` e o ícone `paw` |
| `alt` | `string` | `''` | descrição da foto |
| `priority` | `boolean` | `false` | `true`: `fetchpriority="high"` e `loading="eager"` |

Projeção: `[heroTop]` (canto de cima à esquerda, a 14px).
Hospedeiro: `relative block overflow-hidden rounded-2xl bg-photo md:rounded-3xl`. A altura vem do
pai (referência: 236 / 320 / 400px). Foto: `absolute inset-0 size-full object-cover object-[center_30%]`.
Véu só na base: `absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-scrim to-transparent`.
Nome: receita Display em `text-white`, 36 / 48 / 56px. Subtítulo: `text-sm text-white`. Bloco de
texto a 18px das laterais e 16px da base. Sem foto: sem véu, e nome e subtítulo em `text-foreground`.

### 5.12 `app-action-card` — `action-card/action-card.ts`

O cartão lima que pede uma ação. **No máximo um por tela.**

| Input | Tipo | |
|---|---|---|
| `title` | `string` | obrigatório |

Projeção: conteúdo padrão (o texto) e `[action]` (um `z-button zType="ink" zSize="md"`).
`flex flex-col rounded-2xl bg-primary p-[18px] text-primary-foreground md:p-[22px] xl:p-[26px]`.
Título: `<h2>` com `font-display font-bold leading-[1.12] tracking-[-0.02em] text-primary-foreground`,
22 / 26 / 30px (a classe de cor é obrigatória: sem ela o `h2` herda `text-foreground` e some no
tema escuro). Texto: 14 / 15 / 16px, 8px abaixo do título. Ação: `mt-3.5 self-start`.

## 6. Tela de login migrada (`src/app/features/auth/login/`)

Referências: `design/telas-v2/V2-entrar.dc.html`, `V2-entrar-tablet.dc.html`,
`V2-entrar-desktop.dc.html`. Rota inalterada: `/auth/login`.

### 6.1 O que não muda

- A classe `Login` mantém a mesma API pública usada pelos testes: `form`, `isLoading`,
  `formError`, `isUnconfirmed`, `isGoogleDisabled`, `showSessionExpired`, `showLoggedOut`,
  `errorBannerMessage`, `emailFieldError`, `passwordFieldError`, `emailCtrl`, `passwordCtrl`,
  `submitButtonDisabled`, `onSubmit()`, `onGoogleLogin()`, `onResendConfirmation()`,
  `onProvisionalLink()`.
- Em `login.ts` só mudam: os imports e o `imports: []` (saem os módulos do PrimeNG, entram os
  componentes novos); `MessageService` sai e os três avisos temporários passam a usar o serviço
  do `sonner` com **os mesmos textos**; entra um `signal` `showPassword`. Os getters
  `isErrorBanner`, `isWarnBanner` e `bannerSeverity` podem sair se o template novo não os usar.
- Todos os `data-testid` abaixo continuam existindo, no elemento indicado:

| `data-testid` | Elemento | Observação |
|---|---|---|
| `login-email` | `<input type="email">` | `id="login-email-input"`, `autocomplete="email"`, `inputmode="email"` |
| `login-email-error` | texto de erro do e-mail | `id="login-email-input-error"` |
| `login-password` | `<input>` da senha | `id="login-password-input"`, `autocomplete="current-password"` |
| `login-password-toggle` | botão de mostrar/ocultar senha | |
| `login-password-error` | texto de erro da senha | `id="login-password-input-error"` |
| `login-remember` | caixa "Manter conectado" | controle com `id="login-remember-input"` |
| `login-submit` | botão "Entrar" | `type="submit"` |
| `login-google` | botão do Google | `type="button"` |
| `login-forgot-link` | link "Esqueci a senha" | |
| `login-signup-link` | link "Criar conta" | |
| `login-error` | aviso de erro do formulário | aparece quando `formError() && !isUnconfirmed()` |
| `login-session-expired` | aviso de sessão expirada | |
| `login-logged-out` | aviso "Você saiu com segurança." | |
| `login-unconfirmed-notice` | aviso de e-mail não confirmado | |
| `login-resend-confirmation` | botão "Reenviar e-mail de confirmação" | dentro do aviso acima |
| `login-callback-container` | `oauth-callback.ts` | mantém `role="status"`, `aria-live="polite"`, `aria-label`, `tabindex="-1"` |
| `login-logout` | botão "Sair" em `features/pets/pets/pets.html` | |

- `src/app/features/auth/login/login.spec.ts`: a **única** edição permitida é remover o import
  `MessageService` de `primeng/api` e a linha `MessageService,` dos `providers`. Nenhuma
  expectativa (`expect`) muda. Testes novos podem ser acrescentados no fim do arquivo.

### 6.2 Tom dos avisos

| Situação | `zType` do aviso |
|---|---|
| `formError() === 'invalid'` | `danger` |
| `rate_limited`, `provider_unavailable`, `network` | `neutral` |
| sessão expirada | `neutral` |
| "Você saiu com segurança." | `success` |
| e-mail não confirmado | `neutral` |

### 6.3 Textos

| Onde | Texto |
|---|---|
| Título (`h1`, `id="login-heading"`) | "Que bom" / "te ver de novo." (duas linhas) |
| Abaixo do título | "Entre para cuidar das tags dos seus pets." |
| Rótulos | "E-mail", "Senha", "Manter conectado" |
| Link | "Esqueci a senha" (`aria-label="Esqueci a senha (em breve)"`) |
| Botão principal | "Entrar" |
| Divisor | "ou" |
| Botão do Google | "Entrar com o Google" (sem `aria-label`: o texto visível é o nome) |
| Linha final | "Ainda não tem conta? " + link "Criar conta" (`aria-label="Criar conta (em breve)"`) |

Saem: "Bem-vindo de volta", "Entre na sua conta para acessar o Faro." e o rodapé "Protegido por
Faro" com emoji. Mensagens de erro e textos dos avisos não mudam.

### 6.4 Layout por largura

Estrutura: `<div>` raiz `relative flex min-h-dvh flex-col overflow-hidden bg-background xl:flex-row`
e `<main aria-labelledby="login-heading">` em volta do conteúdo.

| | base | `md` | `xl` |
|---|---|---|---|
| Focinho gigante (lima, `aria-hidden`) | 270px, `right` −76, `top` −74 | 520px, `right` −150, `top` −150 | oculto (está no painel) |
| Painel de marca | oculto | oculto | `app-brand-panel variant="page"` na metade esquerda, com frase e apoio padrão |
| Coluna do formulário | largura total, padding 26px 20px 22px, abaixo de um espaço vazio de 56px no topo | 440px, centralizada na tela (horizontal e vertical), 56px de folga embaixo | 400px, centralizada na metade direita |
| Logo (`app-logo`, `on-light`) | 48px, 22px abaixo | 60px, 28px abaixo | oculto (está no painel) |
| Título | 40px, `leading-[1.02]` | 52px | 44px |
| Texto abaixo do título | 16px, 12px acima | igual | igual |
| Avisos | 16px abaixo do texto | igual | igual |
| Campos | 22px acima; 14px entre os dois | igual | igual |
| Linha "Manter conectado" + "Esqueci a senha" | 8px acima; os dois nas pontas | igual | igual |
| Botão "Entrar" | `lg`, largura total, `text-lg`, 12px acima | igual | igual |
| Divisor "ou" | linha de 1px em `border` dos dois lados, texto 13px `text-muted-foreground`; 16px acima e abaixo | igual | igual |
| Botão do Google | `outline` `lg`, largura total | igual | igual |
| Linha "Ainda não tem conta?" | 14px, centralizada, **empurrada para o pé** da tela | 28px abaixo do botão | 28px abaixo do botão |

- O botão "Voltar" da tela de referência **não entra agora**: ele leva à tela de boas-vindas, que
  é da spec 004. O espaço de 56px no topo do celular fica reservado para ele.
- Os dois links têm `inline-flex min-h-11 items-center` (alvo de 44px).
- O wordmark aparece nas três larguras (decisão de 2026-11-21): na coluna no celular e no tablet,
  no painel no desktop.
- Sem rolagem horizontal em 320px.

### 6.5 Retorno do Google (`callback/oauth-callback.ts`)

Mesma lógica. Visual: coluna centralizada de até 440px, `app-logo` de 48px, spinner de 48px em
`text-foreground`, título receita Title 20px ("Verificando..."), texto 14px em
`text-muted-foreground`. No erro: o texto em `text-text` e o link "Voltar ao login" na receita de
link de texto com `min-h-11`. Os estilos embutidos (`styles: [...]`) saem.

## 7. Como outra spec acrescenta um componente do ZardUI

1. `npx zard-cli@1.12.0 add <nome> --yes` (só o nome necessário; nunca `--all`, nunca `--overwrite`
   sobre um componente já editado).
2. Ler o diff: nenhum import fora de `@angular/*`, `@ng-icons/*`, `class-variance-authority`,
   `clsx`, `tailwind-merge`, `ngx-sonner`, `rxjs` e caminhos do próprio repositório. Qualquer outro
   pacote: parar e avisar.
3. Aplicar as edições comuns da seção 3 (foco, ícones, tokens) e as medidas do `DESIGN.md`.
4. Acrescentar um exemplo na galeria de desenvolvimento (`shells.contract.md` §8).
5. Rodar `npm run lint`, `npm run build`, `npm run check:ui`.

## 8. Caminhos de importação para as specs 003 e 004

| O que | Importar de |
|---|---|
| Botão, campo e demais componentes do ZardUI | `@/shared/components/<nome>` (o `index.ts` copiado) |
| Componentes próprios | `@/shared/components/faro/<nome>/<nome>` |
| Ícones e o tipo `FaroIconName` | `@/shared/icons/faro-icons` |
| Arquivos do logo | `@/shared/components/faro/logo/brand-assets` |
| Cascas | `@/shared/shells/<nome>/<nome>` (ver `shells.contract.md`) |
| Serviço de tema | `@/core/theme/theme.service` |

`@/` aponta para `src/app/` (alias criado pelo `zard-cli init` em `tsconfig.json`).
