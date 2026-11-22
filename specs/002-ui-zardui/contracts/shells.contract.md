# Contrato: cascas de tela, tema escuro e fronteira da página pública

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21
**Fontes**: `DESIGN.md` (Layout), `docs/zardui-faro.md` §5, `design/telas-v2-gerador/lib.js`
(`app`, `flow`, `bottomNav`, `rail`, `sidebar`, `userChip`, `brandPanel`),
`screens-admin.js` (`shell`), `screens-public.js` (`rescue`, `info`, `foot`).
Componentes e tokens citados: `shared-components.contract.md`, `design-tokens.contract.md`.

"Casca" é o componente que desenha a estrutura fixa de uma área (navegação, colunas, painel de
marca) e recebe o conteúdo da tela por projeção (`<ng-content>`). As cascas são **só
apresentação**: não importam `core/auth`, `core/supabase` nem `features/*`. Quem liga a casca aos
dados é um componente hospedeiro dentro de `features/`.

## 1. Arquivos

```text
src/app/
├── core/theme/
│   ├── theme.service.ts            # preferência claro/escuro/sistema (único lugar que lê localStorage para tema)
│   └── theme.service.spec.ts
├── shared/shells/
│   ├── nav-item.ts                 # tipo NavItem
│   ├── leaf-route-data.ts          # leafRouteData<T>(key): Signal<T | undefined>
│   ├── tutor-shell/                # tutor-shell.ts, tutor-shell.html, tutor-nav.ts, tutor-shell.spec.ts
│   ├── screen-header/              # screen-header.ts
│   ├── flow-shell/                 # flow-shell.ts, flow-shell.html, flow-shell.spec.ts
│   ├── admin-shell/                # admin-shell.ts, admin-shell.html, admin-nav.ts, admin-shell.spec.ts
│   ├── public-layout/              # public-layout.ts, public-footer.ts, public-layout.spec.ts
│   └── shell-fallback/             # shell-fallback.ts (tela "em construção" dentro das cascas)
├── features/pets/tutor-app/tutor-app.ts      # hospedeiro da rota /app
├── features/admin/admin-app/admin-app.ts     # hospedeiro da rota /admin
└── features/dev-gallery/                     # galeria de desenvolvimento (só em build de dev)
```

```ts
// nav-item.ts
import type { FaroIconName } from '@/shared/icons/faro-icons';
export interface NavItem {
  id: string;          // usado no data-testid
  label: string;
  icon: FaroIconName;
  link: string;        // caminho absoluto
  exact?: boolean;     // true: só ativo no caminho exato
}
```

## 2. Casca do app do tutor: `app-tutor-shell`

### 2.1 API

| Input | Tipo | Padrão | |
|---|---|---|---|
| `items` | `NavItem[]` | `TUTOR_NAV` | itens da navegação |
| `bottomNav` | `boolean` | `false` | `true` nas telas-raiz: mostra a barra inferior no celular |
| `userName` | `string` | `''` | nome no menu lateral do desktop |
| `userEmail` | `string` | `''` | e-mail no menu lateral do desktop |

Conteúdo projetado: a tela.

```ts
// tutor-nav.ts — caminhos provisórios; as specs 003 e 004 confirmam
export const TUTOR_NAV: NavItem[] = [
  { id: 'inicio', label: $localize`Início`, icon: 'home', link: '/app', exact: true },
  { id: 'pets',   label: $localize`Pets`,   icon: 'paw',  link: '/app/pets' },
  { id: 'scans',  label: $localize`Scans`,  icon: 'scan', link: '/app/scans' },
  { id: 'conta',  label: $localize`Conta`,  icon: 'user', link: '/app/conta' },
];
```

### 2.2 Navegação por largura

As três navegações existem no DOM e a largura decide qual aparece (`md:hidden`,
`hidden md:flex xl:hidden`, `hidden xl:flex`). Cada uma é um `<nav aria-label="Navegação principal">`.
O item ativo tem `aria-current="page"` (use `routerLinkActive` com `ariaCurrentWhenActive="page"` e
`[routerLinkActiveOptions]="{ exact: item.exact ?? false }"`) e as classes
`bg-foreground text-background` (tinta seleciona).

| | Celular (base) | Tablet (`md`) | Desktop (`xl`) |
|---|---|---|---|
| Forma | barra em pílula flutuante embaixo | trilho lateral com ícones | menu lateral com o wordmark |
| Quando | **só se `bottomNav` for `true`** | sempre | sempre |
| `data-testid` | `tutor-shell-bottom-nav` | `tutor-shell-rail` | `tutor-shell-sidebar` |
| Contêiner | `fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 gap-1 rounded-full bg-card p-1.5 shadow-pop` | `sticky top-0 h-dvh w-[88px] shrink-0 flex-col items-center gap-2 bg-card py-[22px]` | `sticky top-0 h-dvh w-[264px] shrink-0 flex-col gap-1.5 bg-card px-5 py-6` |
| Topo | — | `app-focinho` de 34px, `text-primary`, `label="Faro"`, 18px abaixo | `app-logo` de 48px, 22px abaixo |
| Item | `flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold` | `flex h-[60px] w-16 flex-col items-center justify-center gap-[3px] rounded-[18px] text-[11px] font-semibold` | `flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold` |
| Ícone | 20px | 22px | 20px |
| Item inativo | `text-muted-foreground` | `text-muted-foreground` | `text-text` |
| Pé | — | — | identificação do tutor (abaixo) |
| Área do conteúdo | `px-4 pb-4 pt-3`, blocos com `gap-3`; com `bottomNav`, `pb-[104px]` para a barra não cobrir o conteúdo | `px-7 py-6`, `gap-4` | `px-12 py-8`, `gap-5` |

- Cada item tem `data-testid="tutor-nav-<id>"`. Como há três navegações, o mesmo `data-testid`
  aparece três vezes no DOM; nos testes, filtre pelo contêiner visível.
- **Identificação do tutor** (pé do menu lateral, `data-testid="tutor-shell-user"`): círculo de
  44px `bg-foreground text-background font-display text-lg font-semibold` com a inicial do nome;
  ao lado, o nome (`text-[15px] font-semibold text-foreground`) e o e-mail
  (`text-[13px] text-muted-foreground`, cortado com reticências).
- O logo do menu lateral usa `tone="on-dark"` quando o tema resolvido é escuro.
- Primeiro elemento focável: o atalho "Pular para o conteúdo"
  (`sr-only focus:not-sr-only`, em `bg-card`), que leva o foco para `<main id="conteudo" tabindex="-1">`
  por um manipulador de clique (com `<base href="/">`, um `href="#conteudo"` puro navegaria para a
  raiz do site).
- Estrutura: hospedeiro `data-testid="tutor-shell"`; dentro, um contêiner
  `flex min-h-dvh bg-background text-text md:flex-row flex-col` que pinta o fundo (o `body` é
  sempre claro); `<main data-testid="tutor-shell-main">` com o conteúdo.

### 2.3 Cabeçalho de tela: `app-screen-header`

Usado pelas telas internas (as que não são telas-raiz). As telas-raiz desenham o próprio topo
(saudação, sino).

| Input / Output | Tipo | Padrão | |
|---|---|---|---|
| `title` | `string` | obrigatório | vira o `<h1>` da tela |
| `back` | `'back' \| 'close' \| null` | `null` | mostra o botão de voltar ou de fechar |
| `backLink` | `string \| null` | `null` | com valor, o botão é um link |
| `backClick` | `output<void>` | | emitido quando não há `backLink` |

Projeção `[action]`: um controle à direita.
`flex items-center gap-3 min-h-12 md:gap-3.5`. Botão: `z-button zType="ghost" zSize="icon"` com
`class="bg-card"`, ícone `back` ou `close`, `aria-label` "Voltar" ou "Fechar". Título:
`text-[19px] font-semibold` no celular; `md:text-[28px] md:font-bold md:leading-[1.1] md:tracking-[-0.03em]`;
`xl:text-[34px]`.

### 2.4 Telas-raiz

Telas-raiz são Início, Pets, Scans e Conta. A rota declara `data: { hub: true }`; o hospedeiro lê
isso com `leafRouteData<boolean>('hub')` e passa para `bottomNav`. Telas internas (página do pet,
visibilidade, modo perdido…) não têm barra inferior no celular: têm `app-screen-header` com voltar.

```ts
// leaf-route-data.ts: valor de `data[key]` da rota-folha ativa; atualiza a cada NavigationEnd.
export function leafRouteData<T>(key: string): Signal<T | undefined>;
```

## 3. Casca dos fluxos: `app-flow-shell`

Para conta, ativação e cadastro de pet. **Sempre no tema claro.**

| Input / Output | Tipo | Padrão | |
|---|---|---|---|
| `barTitle` | `string` | `''` | nome do fluxo ("Ativar tag") |
| `back` | `'back' \| 'close' \| null` | `null` | |
| `backLink` | `string \| null` | `null` | |
| `backClick` | `output<void>` | | |
| `step` | `{ current: number; total: number } \| null` | `null` | mostra `app-steps` |
| `headline` | `string[]` | linhas padrão da tagline | frase do painel no desktop |
| `sub` | `string` | apoio padrão | |

Projeção: conteúdo padrão (corpo; o `<h1>` é da tela) e `[footer]` (as ações).

| | Celular (base) | Tablet (`md`) | Desktop (`xl`) |
|---|---|---|---|
| Estrutura | uma coluna de largura total | uma coluna de 480px centralizada na tela | `app-brand-panel variant="flow"` de 560px à esquerda; coluna de 440px centralizada no restante |
| Topo | linha `px-4 pt-3`, `min-h-12`: botão + `barTitle` (`font-display text-[19px] font-semibold`) | linha `px-7 pt-6`: `app-logo` de 52px à esquerda, botão à direita | linha `px-8 pt-6 min-h-11`: botão à direita (o logo está no painel) |
| `barTitle` em `md`+ | — | primeira linha da coluna: `font-display text-base font-semibold text-muted-foreground` | igual |
| Corpo | `px-5 pt-3 pb-4`, `gap-4`, ocupa a altura que sobra | `gap-[18px]`, centralizado na vertical, 56px de folga embaixo | igual |
| Ações (`[footer]`) | **ancoradas embaixo**: `px-5 pb-5`, em coluna, `gap-2.5`, centralizadas | dentro da coluna, 10px abaixo do corpo | igual |
| `data-testid` | `flow-shell` no hospedeiro; `flow-shell-back` no botão; `flow-shell-footer` nas ações | | `flow-shell-brand-panel` no painel |

A ação principal é um `z-button zSize="lg"` de largura total; a saída do fluxo é um
`zType="ghost" zSize="md"`. Há um `<main>` em volta do corpo e das ações.

## 4. Casca do admin: `app-admin-shell`

**Sempre no tema claro.**

| Input | Tipo | Padrão |
|---|---|---|
| `items` | `NavItem[]` | `ADMIN_NAV` |

```ts
// admin-nav.ts — caminhos provisórios; a spec 003 confirma
export const ADMIN_NAV: NavItem[] = [
  { id: 'lotes',     label: $localize`Lotes`,         icon: 'list',  link: '/admin', exact: true },
  { id: 'codigos',   label: $localize`Códigos`,       icon: 'qr',    link: '/admin/codigos' },
  { id: 'fila',      label: $localize`Fila de scans`, icon: 'scan',  link: '/admin/fila' },
  { id: 'auditoria', label: $localize`Auditoria`,     icon: 'clock', link: '/admin/auditoria' },
];
```

| | Celular e tablet (abaixo de `xl`) | Desktop (`xl`) |
|---|---|---|
| Forma | barra no topo com abas roláveis | menu lateral |
| `data-testid` | `admin-shell-topbar` | `admin-shell-sidebar` |
| Contêiner | `flex flex-col gap-2.5 bg-card px-4 pb-2.5 pt-3 md:px-7 md:pb-3 md:pt-4` | `sticky top-0 h-dvh w-[264px] shrink-0 flex-col gap-1.5 bg-card px-5 py-6` |
| Marca | `app-logo` de 40px (`md`: 44px) + selo "Admin" (`z-badge zType="ink"`) | `app-logo` de 48px + selo "Admin", 22px abaixo |
| Navegação | `<nav aria-label="Navegação do admin">` em `flex gap-1.5 overflow-x-auto` | `<nav aria-label="Navegação do admin">` em coluna |
| Item | `inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-text`, ícone de 18px, área de toque de 44px | `flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold text-text`, ícone de 20px |
| Item ativo | `bg-foreground text-background`, `aria-current="page"` | igual |
| Área do conteúdo | `px-4 pb-5 pt-[18px]`, `gap-3.5`; `md:px-7 md:py-6 md:gap-[18px]` | `px-12 py-8`, `gap-5` |

Hospedeiro `data-testid="admin-shell"`; itens `data-testid="admin-nav-<id>"`; `<main id="conteudo">`
e o atalho "Pular para o conteúdo", como na casca do tutor. Tabelas viram lista de cartões no
celular: isso é das telas da spec 003, não desta casca.

## 5. Páginas públicas: `app-public-layout` e `app-public-footer`

Para a página da tag (resgate, não ativada, não encontrada) e a página inicial. Renderizadas no
servidor. **Sempre no tema claro.**

### 5.1 `app-public-layout`

| Input | Tipo | Padrão | |
|---|---|---|---|
| `media` | `'photo' \| 'photo-short' \| 'band'` | `'band'` | altura da faixa do topo no celular e no tablet |

Projeção: `[media]` (a foto do pet ou um `app-brand-panel`), conteúdo padrão e `[footer]`.

| | Celular (base) | Tablet (`md`) | Desktop (`xl`) |
|---|---|---|---|
| Estrutura | coluna: faixa do topo, folha, rodapé | igual | duas metades: mídia à esquerda (`w-1/2`, altura total), conteúdo à direita com o rodapé no pé |
| Altura da faixa | `photo` 300px · `photo-short` 250px · `band` 230px | 410 · 350 · 330px | altura total |
| Fundo da faixa | `bg-photo` (a foto ou o painel cobrem) | igual | igual |
| Folha | sobe 28px sobre a faixa (`-mt-7`), `rounded-t-3xl bg-background`, `px-5 pt-6 pb-3.5`, ocupa a altura que sobra | sobe 32px (`md:-mt-8`), `md:rounded-t-4xl`, `md:pt-10 md:pb-5`; conteúdo numa coluna de 560px centralizada | sem folha: `xl:mt-0 xl:rounded-none`; conteúdo centralizado na vertical, `xl:px-24 xl:py-8` |
| `data-testid` | `public-layout` no hospedeiro, `public-layout-media`, `public-layout-sheet` | | |

O conteúdo fica dentro de um `<main>`. A ação principal fica no pé da folha no celular e no tablet
(o conteúdo é uma coluna `flex` e a tela põe um espaçador `flex-1` antes das ações).

### 5.2 `app-public-footer`

| Input | Tipo | Padrão | |
|---|---|---|---|
| `trust` | `string` | obrigatório | linha de confiança |
| `code` | `string \| null` | `null` | código da tag já formatado (`7K3M-Q9XA-C`) |

`relative flex shrink-0 flex-col gap-1.5 overflow-hidden bg-brand text-brand-foreground px-5 pt-4 pb-[18px]
md:px-[104px] md:pt-5 md:pb-[22px] xl:px-24 xl:pt-[22px] xl:pb-6`, `data-testid="public-footer"`.
Dentro: `app-focinho` em `text-brand-deep` (250px, `right` −78px, `top` −34px; `md`+: 300px,
`right` −60px), `aria-hidden`; a tagline "O caminho de volta para casa." em
`font-display text-lg font-bold tracking-[-0.02em]`; a linha de confiança em
`max-w-[300px] text-[13px] leading-[1.4] text-brand-muted`; e, se houver, "Tag " + código em
`font-display text-[13px] font-semibold text-primary`.

### 5.3 Regras da página pública

1. **Sem overlay**: nada de diálogo, folha deslizante, popover, menu suspenso, tooltip nem aviso
   temporário.
2. **Utilizável antes da hidratação**: a ação principal é um `<a href>`; nada essencial depende
   de JavaScript.
3. **Sempre clara**: não injeta `ThemeService`, nunca fica dentro de `.dark`.
4. Não importa nada do app autenticado (seção 9).
5. Imagens com `width` e `height`; a foto principal com `fetchpriority="high"`.
6. Texto de pelo menos 16px; um botão grande (`zSize="rescue"`).

## 6. Tema escuro

### 6.1 Onde vale

| Área | Tema |
|---|---|
| App autenticado do tutor (`/app/**`, dentro de `app-tutor-shell`) | claro ou escuro, conforme a preferência |
| Páginas públicas (`/`, `/:codigo`) | **sempre claro** |
| Entrar, criar conta, confirmar celular, ativação (`/auth/**`, fluxos) | **sempre claro** |
| Admin (`/admin/**`) | **sempre claro** |

### 6.2 `ThemeService` (`src/app/core/theme/theme.service.ts`)

```ts
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'faro.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** O que o tutor escolheu. Padrão: 'system'. */
  readonly preference: Signal<ThemePreference>;
  /** O tema que vale agora: 'system' é resolvido por prefers-color-scheme. */
  readonly resolved: Signal<ResolvedTheme>;
  /** Grava a escolha neste aparelho. */
  setPreference(preference: ThemePreference): void;
}
```

- A preferência fica em `localStorage`, na chave `faro.theme`, **por aparelho**. Não vai para o
  servidor. Valor ausente ou inválido vale `'system'`.
- `'system'` acompanha `matchMedia('(prefers-color-scheme: dark)')`, inclusive quando o sistema
  muda com o app aberto.
- No servidor (sem `window`), `preference` é `'system'` e `resolved` é `'light'`. Leitura e
  escrita de `localStorage` ficam dentro de `try/catch` (navegação privada pode negar).
- O serviço **não** toca no DOM. Quem aplica a classe é a casca do tutor.
- A tela em que o tutor escolhe claro, escuro ou sistema é da spec 004; ela só chama
  `setPreference`.
- `localStorage` só é permitido em `core/` (regra de ESLint já existente). Por isso o serviço
  mora em `core/theme/`.

### 6.3 Como a casca do tutor aplica

1. O hospedeiro de `app-tutor-shell` tem `[class.dark]="theme.resolved() === 'dark'"`.
2. `@custom-variant dark (&:is(.dark *))` só alcança **descendentes** de `.dark`. Por isso as
   classes visuais ficam num contêiner **dentro** do hospedeiro, e é esse contêiner que pinta o
   fundo (`bg-background`).
3. Diálogos e outros overlays do ZardUI são anexados **fora** da casca (em `body`, num contêiner
   próprio; o spike da tarefa T003 registra qual). Enquanto a casca está montada e o tema é
   escuro, ela replica a classe `dark` nesse contêiner; ao ser destruída, **remove**. Sem isso um
   diálogo aberto no app escuro sai claro.
4. A classe `dark` **nunca** é posta em `document.documentElement` nem em `document.body`.
5. Como o app do tutor é renderizado no navegador (rota `RenderMode.Client`), o tema é aplicado
   antes da primeira pintura da casca: não há lampejo de tema errado.

Limite conhecido: no celular, ao puxar a tela além do fim (efeito elástico), aparece o fundo claro
do `body` por trás da casca escura. Aceito no MVP.

## 7. Rotas depois desta feature

```ts
// src/app/app.routes.ts (ordem importa: rotas fixas antes de :codigo)
{ path: '', loadComponent: Landing }                                     // público, pré-renderizado
{ path: 'app', canMatch: [authGuard], loadComponent: TutorApp, children: [
    { path: '', loadComponent: Pets, data: { hub: true }, title: 'Meus pets — Faro' },
    { path: '**', loadComponent: ShellFallback, data: { home: '/app' } },
] }
{ path: 'admin', canMatch: [authGuard, adminGuard], loadComponent: AdminApp, children: [
    { path: '', loadComponent: Admin, title: 'Administração — Faro' },
    { path: '**', loadComponent: ShellFallback, data: { home: '/admin' } },
] }
{ path: 'auth', canMatch: [anonGuard], children: [ /* inalterado */ ] }
...(ngDevMode ? [{ path: 'dev/ui', loadChildren: () => import('./features/dev-gallery/dev-gallery.routes').then((m) => m.DEV_GALLERY_ROUTES) }] : [])
{ path: ':codigo/perdido', … }  { path: ':codigo', … }                   // inalterados (a spec 003 refaz)
```

- `src/app/app.routes.server.ts` ganha `{ path: 'app/**', renderMode: RenderMode.Client }` e
  `{ path: 'admin/**', renderMode: RenderMode.Client }`. As demais linhas ficam como estão.
- `TutorApp` (`features/pets/tutor-app/tutor-app.ts`): injeta `AuthStore`, monta
  `<app-tutor-shell [bottomNav]="isHub() === true" [userName]="userName()" [userEmail]="userEmail()"><router-outlet /></app-tutor-shell>`
  e o `<z-toaster>`. `userEmail` vem de `store.user()?.email`; `userName`, de
  `user_metadata['name']` ou, na falta, da parte do e-mail antes do `@`.
- `AdminApp` (`features/admin/admin-app/admin-app.ts`): `<app-admin-shell><router-outlet /></app-admin-shell>`
  e o `<z-toaster>`.
- `ShellFallback`: estado vazio com o título "Esta parte ainda está em construção.", a frase
  "Ela chega nas próximas entregas." e o botão "Voltar ao início" para `data.home`.
  `data-testid="shell-fallback"`. As specs 003 e 004 acrescentam as rotas reais **antes** do `**`.
- `Pets` e `Admin` (telas provisórias) perdem o `<main>` e o cabeçalho próprios (a casca já tem) e
  mantêm `data-testid="pets-home"`, `data-testid="login-logout"` e `data-testid="admin-home"`.
- `Landing` (`/`) passa a usar `app-public-layout` com `app-brand-panel` e mantém
  `data-testid="public-landing"` e `data-testid="public-landing-cta"`.

## 8. Galeria de desenvolvimento (`src/app/features/dev-gallery/`)

Superfície para ver e testar componentes e cascas sem sessão e sem banco. **Só existe em build de
desenvolvimento**: a rota é registrada dentro de `ngDevMode ? [...] : []`; o Angular CLI troca
`ngDevMode` por `false` em produção e o código some do pacote (verificado por
`scripts/ui-checks/public-bundle.mjs`).

| Rota | `data-testid` da página | Conteúdo |
|---|---|---|
| `/dev/ui` | `dev-gallery` | índice com links para as páginas abaixo |
| `/dev/ui/components` | `dev-gallery-components` | todo componente da `shared-components.contract.md`, em todas as variantes e estados (normal, desativado, inválido, carregando) |
| `/dev/ui/tutor` | `dev-gallery-tutor` | `app-tutor-shell` com `bottomNav` ligado: capa do pet, cartão lima, cartões de número, grupo de linhas com interruptor, chips, selos, campos e um botão que abre um diálogo |
| `/dev/ui/tutor/inner` | `dev-gallery-tutor-inner` | `app-tutor-shell` sem barra inferior, com `app-screen-header` (voltar) |
| `/dev/ui/flow` | `dev-gallery-flow` | `app-flow-shell` com passos, campos, células de código e ações |
| `/dev/ui/admin` | `dev-gallery-admin` | `app-admin-shell` com título, selos e um grupo de linhas |
| `/dev/ui/public` | `dev-gallery-public` | `app-public-layout media="band"` com painel de marca, cartão de informação, botão `rescue` e rodapé |
| `/dev/ui/public/photo` | `dev-gallery-public-photo` | `app-public-layout media="photo"` com `app-brand-mark` sobre `bg-photo` e rodapé |

- Na galeria, os itens de navegação das cascas apontam para as próprias páginas da galeria.
- Dados de exemplo: Ana (`ana@email.com`), Paçoca, tag `7K3M-Q9XA-C`. Sem foto real: use `bg-photo`.
- A galeria não chama `core/auth` nem `core/supabase`.
- Os caminhos têm dois ou mais segmentos, então nunca colidem com `/:codigo`.

## 9. Fronteira da página pública (ESLint)

`eslint.config.js`, bloco `files: ['src/app/features/public/**/*.ts']`, regra
`no-restricted-imports` com estes padrões:

```js
group: [
  '**/features/auth/**', '**/features/activation/**', '**/features/pets/**', '**/features/scans/**',
  '**/features/account/**', '**/features/admin/**', '**/features/dev-gallery/**',
  '**/core/auth/**', '**/core/theme/**',
  '**/shells/tutor-shell/**', '**/shells/admin-shell/**', '**/shells/flow-shell/**',
  '**/shells/screen-header/**', '**/shells/shell-fallback/**',
  '**/components/alert-dialog/**', '**/components/sonner/**', '**/components/sheet/**',
  '**/components/dialog/**', '**/components/popover/**', '**/components/dropdown/**',
  '**/components/select/**', '**/components/tooltip/**',
],
message: 'Rescue-First: features/public não importa o app autenticado, o tema escuro nem overlays. A página da tag tem de ser pequena e funcionar sozinha.',
```

- Saem os padrões de pastas que deixaram de existir: `health-records`, `subscription`,
  `reminders`, `billing`, `core/billing`.
- `features/public` **pode** importar: `shared/shells/public-layout`, `shared/components/faro/*`,
  `shared/components/{button,badge,card,item,alert,spinner,skeleton,input,field}`, `shared/icons`.
- A spec 003 prevê um serviço mínimo em `core/tags` para detectar o dono; ela abre essa exceção
  lá. `core/auth` continua proibido aqui.
- `scripts/ui-checks/boundary.mjs` prova a regra: passa um arquivo fictício de `features/public`
  com cada import proibido pela API do ESLint e exige erro; passa os imports permitidos e exige
  zero erro.

## 10. Fronteira no pacote gerado

`npm run build:stats` gera `dist/faro/stats.json` (o mapa do esbuild: para cada arquivo de saída,
os arquivos-fonte que entraram nele e os imports). `scripts/ui-checks/public-bundle.mjs` verifica:

1. **Fecho da página pública**: partindo de `main-*.js`, `polyfills-*.js` e de toda saída cujo
   `entryPoint` esteja em `src/app/features/public/`, e seguindo só imports **estáticos**
   (`kind: 'import-statement'`), nenhum arquivo-fonte alcançado casa com:
   `src/app/features/(auth|activation|pets|scans|account|admin|dev-gallery)/`,
   `src/app/shared/shells/(tutor-shell|admin-shell|flow-shell|screen-header|shell-fallback)/`,
   `src/app/core/theme/`, `src/app/shared/components/(alert-dialog|sonner)/`, `node_modules/ngx-sonner/`.
2. **Galeria fora de produção**: nenhum arquivo de saída contém fonte de
   `src/app/features/dev-gallery/`.
3. **Sem manipulador embutido**: `dist/faro/browser/index.csr.html` e os `.html` pré-renderizados
   não têm o atributo `onload=` (ver `research.md` §R9).
4. **Varredura do Tailwind restrita**: nenhum `.css` de `dist/faro/browser/` contém `0FA12E`.

**Exceção conhecida, que não reprova**: `src/app/core/auth/**` e `src/app/core/supabase/**` já
estão no pacote inicial hoje, porque `app.routes.ts` importa os guards de forma estática. O script
lista esses arquivos como aviso. Tirar isso do pacote inicial é trabalho da spec 003 (meta de
100 KB na rota pública) e está registrado em `research.md` §R15.

## 11. Checagens que cobrem este contrato

| O que | Onde |
|---|---|
| Navegação certa em cada largura; barra inferior só em tela-raiz; sem rolagem horizontal | `e2e/ui-shells.spec.ts` (galeria, 390 / 768 / 1440 e 320) |
| `aria-current`, atalho de pular, nomes das navegações | `*.spec.ts` das cascas + axe no e2e |
| `.dark` só na casca do tutor; páginas públicas, fluxos, admin e login claros mesmo com o aparelho em escuro e `faro.theme = 'dark'` | `e2e/ui-theme.spec.ts` |
| Diálogo aberto no app escuro sai escuro; classe removida ao sair da casca | `tutor-shell.spec.ts` + `e2e/ui-theme.spec.ts` |
| Preferência persiste e `'system'` acompanha o aparelho | `theme.service.spec.ts` |
| Fronteira de imports | `scripts/ui-checks/boundary.mjs` |
| Fronteira no pacote | `scripts/ui-checks/public-bundle.mjs` |
