# Quickstart: nova base de interface do Faro

**Feature**: `002-ui-zardui` · **Data**: 2026-11-21

Como rodar, ver e verificar o que esta feature entrega. Vale **depois** de as tarefas serem
executadas; antes disso o projeto ainda está em PrimeNG.

O shell da máquina é o PowerShell 5.1, que **não tem `&&`**. Rode um comando por linha.

## 1. Preparar

```bash
npm install
npx playwright install chromium
```

Não é preciso subir o Supabase: nada desta feature fala com o banco. A tela de entrar abre sem
backend (só não autentica).

## 2. Ver

```bash
npm start
```

| Endereço | O que mostra |
|---|---|
| `http://localhost:4200/` | página inicial provisória (painel de marca) |
| `http://localhost:4200/auth/login` | tela de entrar, nova identidade |
| `http://localhost:4200/dev/ui` | **galeria de desenvolvimento**: índice |
| `http://localhost:4200/dev/ui/components` | todos os componentes, em todos os estados |
| `http://localhost:4200/dev/ui/tutor` | casca do app do tutor (tela-raiz, com barra inferior no celular) |
| `http://localhost:4200/dev/ui/tutor/inner` | casca do app do tutor (tela interna, com voltar) |
| `http://localhost:4200/dev/ui/flow` | casca dos fluxos |
| `http://localhost:4200/dev/ui/admin` | casca do admin |
| `http://localhost:4200/dev/ui/public` | página pública com painel de marca |
| `http://localhost:4200/dev/ui/public/photo` | página pública com área de foto |

A galeria só existe com `npm start` (build de desenvolvimento). Em produção a rota não existe.

**Larguras**: no DevTools, modo de dispositivo, teste 320, 390, 768 e 1440 de largura.

**Tema escuro**: vale só em `/dev/ui/tutor` (e, com sessão, em `/app`). Três formas de ligar:

1. os botões "Claro / Escuro / Sistema" no topo da página `/dev/ui/tutor`;
2. no console do navegador: `localStorage.setItem('faro.theme', 'dark')` e recarregar;
3. DevTools → Rendering → "Emulate CSS media feature prefers-color-scheme: dark", com a
   preferência em "Sistema".

Depois abra `/dev/ui/flow`, `/dev/ui/admin`, `/dev/ui/public` e `/auth/login`: todos têm de
continuar claros.

## 3. Verificar

```bash
npm run build
npm run lint
npm test -- --watch=false
npm run check:ui
npm run build:stats
npm run check:bundle
npm run e2e
```

| Comando | O que prova |
|---|---|
| `npm run build` | compila com SSR e pré-render |
| `npm run lint` | ESLint, incluindo a fronteira da página pública |
| `npm test -- --watch=false` | testes de unidade (login incluído). **Sem `--watch=false` o comando não termina** |
| `npm run check:ui` | roda `check:tokens` (valores e contraste dos tokens nos dois temas, arquivo único de tema), `check:stack` (nada de PrimeNG, de service worker, da identidade antiga; `.dark` só na casca do tutor; nenhuma cor solta) e `check:boundary` (regra de imports de `features/public`) |
| `npm run build:stats` | build de produção com `dist/faro/stats.json` |
| `npm run check:bundle` | a página pública não carrega o app autenticado; a galeria não está no build; nenhum `onload=` embutido; o Tailwind não varreu `docs/` nem `specs/` |
| `npm run e2e` | Playwright: fumaça, galeria, identidade, login nas três larguras, cascas, tema, worker antigo; com axe |

Um arquivo de e2e de cada vez: `npx playwright test e2e/login-ui.spec.ts`.

## 4. Onde está cada coisa

| Quero mudar… | Arquivo |
|---|---|
| uma cor, raio ou fonte | `src/styles.css` (e a tabela em `contracts/design-tokens.contract.md`) |
| os arquivos do logo | `public/logos/` e, se o nome ou a proporção mudarem, **só** `src/app/shared/components/faro/logo/brand-assets.ts` |
| um ícone | `src/app/shared/icons/faro-icons.ts` |
| uma variante de botão | `src/app/shared/components/button/button.variants.ts` |
| a navegação do tutor | `src/app/shared/shells/tutor-shell/tutor-nav.ts` |
| a navegação do admin | `src/app/shared/shells/admin-shell/admin-nav.ts` |
| o tema padrão | `src/app/core/theme/theme.service.ts` |
| os ícones do app | `node scripts/generate-icons.mjs` (lê `public/logos/logo-compact.svg`) |

## 5. Acrescentar um componente do ZardUI (specs 003 e 004)

```bash
npx zard-cli@1.12.0 add <nome> --yes
```

Depois:

1. Leia o diff. Imports permitidos: `@angular/*`, `@ng-icons/*`, `class-variance-authority`,
   `clsx`, `tailwind-merge`, `ngx-sonner`, `rxjs` e caminhos do repositório. Outro pacote: pare e
   avise.
2. Tire as classes de foco (`focus-visible:ring-*`, `outline-none`, `outline-hidden`): o foco é
   global.
3. Troque os ícones `lucide*` pelos nomes do Faro, tire o `provideIcons` local e rode
   `npm rm @ng-icons/lucide` se o CLI o reinstalou.
4. Ajuste alturas, raios e cores ao `DESIGN.md`, só com tokens.
5. Ponha um exemplo em `/dev/ui/components`.
6. Rode `npm run lint`, `npm run build` e `npm run check:ui`.

Nunca: `add --all`, `add dark-mode`, `add sidebar`, `add <nome> --overwrite` sobre um componente
já editado.

## 6. Usar numa tela nova

```ts
import { ZardButtonComponent } from '@/shared/components/button';          // confira o nome exportado no index.ts copiado
import { ActionCard } from '@/shared/components/faro/action-card/action-card';
import { ThemeService } from '@/core/theme/theme.service';
```

- Tela do app do tutor: é filha da rota `/app` (o hospedeiro `TutorApp` já põe a casca). Tela-raiz
  declara `data: { hub: true }`; tela interna usa `<app-screen-header>`.
- Tela de fluxo: envolve o conteúdo em `<app-flow-shell>`.
- Tela do admin: é filha da rota `/admin`.
- Página pública: usa `<app-public-layout>`; **não** importa nada das linhas acima marcadas como
  app autenticado (o lint reprova).
- A rota nova entra **antes** do `**` que leva ao aviso de "em construção".

## 7. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `npm test` não volta | faltou `-- --watch=false` |
| Classe do Tailwind sem efeito | o arquivo está fora de `src/`, ou a classe foi montada por concatenação de texto (o Tailwind só enxerga classes escritas por inteiro) |
| Tela sem estilo **só em produção** | o CSS crítico embutido voltou (`inlineCritical`); rode `npm run check:bundle` |
| Erro `NG1010` | um componente saiu do `import` mas ficou no `imports: []` |
| Lint reprova `z-button` | o bloco de exceção do ESLint para o código do ZardUI não cobre a pasta nova |
| Diálogo claro dentro do app escuro | a casca do tutor não replicou a classe no contêiner de overlays |
| Página pública escura | alguém pôs `dark` fora da casca do tutor; rode `npm run check:stack` |
| Ícone não aparece | o nome não está em `faro-icons.ts`, ou o componente tem `provideIcons` local |
| A galeria dá 404 | você está num build de produção; ela só existe com `npm start` |
