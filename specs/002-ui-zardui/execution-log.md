# Execution log: 002-ui-zardui

## Linha de base

- Data: 2026-11-21
- Branch: `002-ui-zardui` (criada de `develop`, commit de partida `2cf0173`)
- `git status --short` antes de qualquer mudança: vazio (árvore limpa)

| Comando | Resultado |
|---|---|
| `npm run build` | passou (Angular 21, SSR, 1 rota pré-renderizada) |
| `npm run lint` | passou ("All files pass linting.") |
| `npm test -- --watch=false` | passou: 9 arquivos, 44 testes |
| `npx playwright test e2e/smoke.spec.ts` | passou: 1 teste (na primeira rodada faltava o navegador; rodado `npx playwright install chromium` e repetido, como a T001 manda) |

### Tamanhos de `dist/faro/browser/` (bytes)

| Arquivo | Bytes |
|---|---|
| chunk-3QFA5SSD.js | 451 |
| chunk-6FFV4G3K.js | 88057 |
| chunk-6YZSW5GL.js | 81353 |
| chunk-6ZEZ5ST6.js | 982 |
| chunk-7AOSXPD2.js | 4840 |
| chunk-EP6PJF4N.js | 1822 |
| chunk-FKKVDWAJ.js | 41129 |
| chunk-GWVPYNGX.js | 176509 |
| chunk-H2B6VC2R.js | 211526 |
| chunk-JOHBSRU7.js | 198445 |
| chunk-MR2ECVFE.js | 12267 |
| chunk-PAQOKZQ6.js | 725 |
| chunk-ROGBYIJS.js | 65 |
| main-3KIOEV5V.js | 117680 |
| polyfills-PZSJNBYU.js | 494 |
| ngsw-worker.js | 84094 |
| safety-worker.js | 785 |
| worker-basic.min.js | 785 |
| styles-DUBPCF23.css | 35752 |
| index.csr.html | 19336 |
| index.html | 78658 |

- Soma dos `.js` (todos, incluindo os três do service worker): 1.022.009 bytes
- Soma dos `.js` sem os scripts do service worker (`ngsw-worker`, `safety-worker`, `worker-basic.min`): 936.345 bytes
- Soma dos `.css`: 35.752 bytes

## Spike

Data: 2026-11-21. Cópia de trabalho `../faro-spike-002` (branch `spike/002-zardui`, criada de `d186c3b`). Nenhum `--force`, `--legacy-peer-deps`, `overrides` ou edição manual de versão foi usado. Os comandos rodaram exatamente como escritos na T003 (`zard-cli@1.12.0`).

### Execução dos comandos

| Comando | Resultado |
|---|---|
| `npm ci` | passou (621 pacotes; `npm audit` aponta 60 vulnerabilidades já existentes: 2 baixas, 33 moderadas, 22 altas, 3 críticas; avisos `allow-scripts` de 4 pacotes com script de instalação) |
| `zard-cli@1.12.0 init ...` | passou, sem aviso de peer dependency |
| `zard-cli@1.12.0 add button input field checkbox alert-dialog sonner input-otp --yes` | passou: o CLI recusou nenhum componente. Instalou 8 componentes: os 7 pedidos mais `input-group` (dependência de `input`/`field`, não pedida) |
| `npm i @boxicons/js@1.0.1` | passou |
| `npm ls @angular/core @angular/cdk @ng-icons/core` (e os demais pacotes abaixo) | saída 0, sem `invalid`, sem `ERESOLVE`, sem `UNMET`, sem `extraneous` |
| `npx ng build` | passou, com 1 aviso: `bundle initial exceeded maximum budget` (initial 622,87 kB contra orçamento de 500 kB; styles 162,88 kB). A causa provável é o CSS do Tailwind/ZardUI somado ao PrimeNG, que ainda está instalado nesta fase |
| `npx ng test --watch=false` | passou: 9 arquivos, 44 testes (igual à linha de base) |
| `npx ng lint` | 36 erros, todos em código copiado do ZardUI (ver item 4); não é condição de parada |

Outras observações: o `add` imprimiu `added 1 package, and removed 5 packages` (não investigado; `npm ls` ficou limpo). Depois do `add` e do `npm i @boxicons/js`, `npm audit` aponta 57 vulnerabilidades (2 baixas, 33 moderadas, 19 altas, 3 críticas), todas em pacotes que já existiam; não foi rodado `npm audit` por pacote.

### 1. Versões instaladas

| Pacote | Versão |
|---|---|
| `@angular/core` | 21.2.16 |
| `@angular/cdk` | 21.2.14 |
| `@ng-icons/core` | 34.0.0 |
| `@ng-icons/lucide` | 34.0.0 |
| `tailwindcss` | 4.3.5 |
| `@tailwindcss/postcss` | 4.3.5 |
| `tailwindcss-animate` | 1.0.7 |
| `class-variance-authority` | 0.7.1 |
| `ngx-sonner` | 3.1.0 |
| `@boxicons/js` | 1.0.1 |
| `clsx` | 2.1.1 (declarado `^2.1.1`) |
| `tailwind-merge` | 3.7.1 (declarado `^3.7.1`) |
| `postcss` | 8.5.33 (declarado `^8.5.33`) |

`primeng`, `primeicons` e `@primeuix/themes` continuam no `package.json` (a spike não os remove).

### 2. `git status --short` da cópia depois do `init`

```
 M package-lock.json
 M package.json
 M src/app/app.config.ts
 M src/styles.css
 M tsconfig.json
?? .postcssrc.json
?? components.json
?? src/app/shared/
```

Dentro de `src/app/shared/` o `init` criou só `core/` (`css/zard.css`, `directives/`, `i18n/` com 7 locales e registry, `overlay/overlay-ref.ts`, `overlay/overlay-stack.ts`, `provider/`) e `utils/` (`merge-classes.ts`, `noop.ts`, `number.ts`, `index.ts`). Todos os arquivos estão na lista permitida da condição de parada 5; `angular.json` não foi tocado. O `init` não rodou na cópia nenhuma edição fora da lista.

### 3. Os 7 componentes

| Componente | Classe exportada | Seletor | `input()` de variante |
|---|---|---|---|
| button | `ZardButtonComponent` | `z-button, button[z-button], a[z-button]` | `zType`, `zSize`, `zShape`, `zLoading`, `zDisabled`, `class` |
| input | `ZardInputComponent` | `input[z-input]` | nenhum de variante; só `class` e `value` (`model`) |
| field | `ZardFieldComponent` (e `ZardFieldSetComponent`, `…LegendComponent`, `…GroupComponent`, `…ContentComponent`, `…LabelComponent`, `…TitleComponent`, `…DescriptionComponent`, `…SeparatorComponent`, `…ErrorComponent`) | `z-field, [z-field]` (e `z-field-set`, `z-field-legend`, `z-field-group`, `z-field-content`, `z-field-label`, `z-field-title`, `z-field-description`, `z-field-separator`, `z-field-error`) | `zOrientation` (no campo), `zVariant` (na legenda), `zErrors`, `zContent` |
| checkbox | `ZardCheckboxComponent` | `z-checkbox, [z-checkbox]` | nenhum de variante; `zDisabled`, `zInvalid`, `zId`, `class` |
| alert-dialog | `ZardAlertDialogComponent` (+ `…Container`, `…Panel`, `…Header`, `…Media`, `…Title`, `…Description`, `…Footer`, `…CloseDirective`) e `ZardAlertDialogService` | `z-alert-dialog` (+ `z-alert-dialog-container/-panel/-header/-media/-title/-description/-footer`, `[z-alert-dialog-close]`) | `zSize`, `zWidth`, `zMaskClosable`, `zDuration` (no painel/host) |
| sonner | `ZardSonnerComponent` | `z-sonner` (**não** `z-toaster`) | `position` (padrão `top-center`), `theme`, `richColors`, `expand`, `duration`, `visibleToasts`, `closeButton`, `toastOptions`, `style`, `dir`, `topLayer`, `class` |
| input-otp | `ZardInputOtpComponent` (+ `…Signal`, `…Group`, `…Slot`, `…Separator`) | `z-input-otp, [z-input-otp]` (+ `z-input-otp-signal`, `-group`, `-slot`, `-separator`) | `zSize`, `zMaxLength`, `zPattern` (padrão `'[0-9]'`), `zIntegerOnly` (padrão `true`), `zReadonly`, `zInvalid`, `class` |

Atenção para as tarefas T023 e T031: o seletor do aviso temporário é `z-sonner`, e o contrato fala em `<z-toaster>`. Ao chegar lá, conferir `sonner/index.ts`. Também: `zPattern` padrão é só dígitos e `zIntegerOnly` padrão é `true` (T024 precisa tratar os dois para aceitar `K47Q9M`).

### 4. Erros do `ng lint` em código copiado (36, por regra)

| Regra | Quantidade |
|---|---|
| `@angular-eslint/component-selector` | 30 |
| `@angular-eslint/directive-selector` | 4 |
| `@typescript-eslint/array-type` | 1 (`field.component.ts:245`, `ReadonlyArray<T>`) |
| `@typescript-eslint/no-unused-vars` | 1 (`string-template-outlet.directive.ts:145`, `_ctx` só usado como tipo) |

Os dois últimos não são de seletor: a T006 manda desligar regra de estilo de TypeScript só no bloco do código copiado; fica anotado para a T006. Nenhuma regra de acessibilidade de template foi acusada. Nenhum erro em código do Faro.

### 5. `src/app/shared/core/css/zard.css` e variáveis

Declara uma única variável: `--animate-caret-blink: caret-blink 1s ease-out infinite;`. Não é variável de cor, raio ou fonte das tabelas do contrato. O arquivo também tem os utilitários `no-scrollbar` e `scrollbar-thin`.

### 6. Onde o diálogo é anexado

Nenhuma referência a `OverlayContainer`, `cdk-overlay-container` ou `document.body` nos arquivos copiados. O diálogo usa o CDK: `ZardAlertDialogService` injeta `Overlay` (`@angular/cdk/overlay`), cria o overlay com `position().global()` e `scrollStrategies.block()` e anexa um `ComponentPortal`. O CDK é quem cria o `<div class="cdk-overlay-container">` no `document.body`. Por código, o elemento se obtém com `inject(OverlayContainer).getContainerElement()` (de `@angular/cdk/overlay`). O componente declarativo `z-alert-dialog` anexa um `TemplatePortal` pelo mesmo `Overlay`. O `z-sonner` não usa overlay do CDK (o toaster é inline).

### 7. Símbolos `lucide*` importados

`lucideLoaderCircle` (button), `lucideCheck` (checkbox), `lucideTrash2` (alert-dialog), e no sonner `lucideCircleCheck`, `lucideInfo`, `lucideLoader2`, `lucideOctagonX`, `lucideTriangleAlert`. Total: 8 símbolos em 4 arquivos (`button.component.ts`, `checkbox.component.ts`, `alert-dialog.component.ts`, `sonner.component.ts`). Observação: nenhum dos arquivos copiados na spike tinha `lucide` em `input`, `field`, `input-group` ou `input-otp`.

### 8. `bg-primary` no CSS gerado

Sim. `dist/faro/browser/styles-*.css` contém `.bg-primary{background-color:var(--primary)}`.

### Condições de PARADA

1. nenhum `--force`/`--legacy-peer-deps` e `npm ls` limpo: não ocorreu;
2. o `add` aceitou todos os componentes: não ocorreu;
3. `ng build` passou: não ocorreu;
4. `ng test` igual à linha de base (44 testes): não ocorreu;
5. `init` só mexeu em arquivos da lista: não ocorreu;
6. imports dos arquivos copiados todos dentro da lista permitida (`@angular/*` incluindo `@angular/cdk/*` e `@angular/forms/signals`, `@ng-icons/core`, `@ng-icons/lucide`, `class-variance-authority`, `clsx`, `tailwind-merge`, `ngx-sonner`, `rxjs`; relativos e `@/…`): não ocorreu.

Resultado: APROVADO

## Desvios e decisões

- `npx playwright install chromium` foi necessário (navegador ausente na máquina). Isso não altera o repositório.
- A pasta `test-results/` criada pelo Playwright não está no `.gitignore`; é artefato local e não é commitada.

- T004: `zard-cli@1.12.0 init` rodou sem aviso; só mexeu nos arquivos da lista da condição de parada 5 (`package.json`, `package-lock.json`, `tsconfig.json` com alias `@/*`, `app.config.ts` com `provideZard()`, `src/styles.css`, `.postcssrc.json`, `components.json`, `src/app/shared/core/**`, `src/app/shared/utils/**`). Build passou (aviso de orçamento do bundle inicial: 590,85 kB contra 500 kB, esperado com PrimeNG e Tailwind juntos).
- **Armadilha de ambiente**: `npm test -- --watch=false` rodado pelo Git Bash (cwd `d:/...` com `d` minúsculo) falha com "Vitest failed to find the runner" nos 9 arquivos; rodado pelo PowerShell (cwd `D:\...`) passa com 44 testes. Rodar `ng test` sempre pelo PowerShell.
- T005: `add` instalou 19 componentes (os 18 pedidos mais `input-group`, dependência de `input`/`field`). Pacote novo em `dependencies`: só `ngx-sonner`. Imports de `src/app/shared/**` fora de `.`/`@/`: `@angular/*` (incl. `cdk/a11y`, `cdk/bidi`, `cdk/overlay`, `cdk/portal`, `forms/signals`, `core/rxjs-interop`, `platform-browser`), `@ng-icons/core`, `@ng-icons/lucide`, `class-variance-authority`, `clsx`, `ngx-sonner`, `rxjs`, `tailwind-merge`: todos dentro da lista permitida. `npm audit --audit-level=high`: 57 vulnerabilidades (2 baixas, 33 moderadas, 19 altas, 3 críticas), o mesmo número da spike antes dos componentes; `ngx-sonner` não consta entre os pacotes afetados; nada corrigido (regra 7). Build passou.

## Regras de lint desligadas

Bloco em `eslint.config.js` com `files` = `src/app/shared/core/**/*.ts`, `src/app/shared/utils/**/*.ts`, `src/app/shared/components/**/*.ts` e `ignores` = `src/app/shared/components/faro/**`:

- `@angular-eslint/component-selector`: off (30 ocorrências no código copiado) — T006
- `@angular-eslint/directive-selector`: off (4 ocorrências) — T006
- `@typescript-eslint/array-type`: off (1: `field.component.ts`, `ReadonlyArray<T>`) — T006
- `@typescript-eslint/no-unused-vars`: off (1: `string-template-outlet.directive.ts`, `_ctx` usado só como tipo) — T006

Nenhuma regra de acessibilidade de template foi acusada; `no-restricted-globals` (`localStorage`) continua ligada.

## Resultado final

(a preencher no fim da spec)
