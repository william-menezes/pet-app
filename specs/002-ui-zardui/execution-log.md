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
- T007: `zard.css` só declara `--animate-caret-blink` (não é token das tabelas do contrato): nada apagado. `source('.')` funcionou; o comando de verificação imprimiu `ok` (lima presente, canário `0FA12E` ausente). `src/styles.css` sem `oklch`. A linha `@import './app/shared/core/css/zard';` ficou como o `init` escreveu.
- T008: `scripts/ui-checks/tokens.mjs` confere 65 variáveis (claro e escuro) e 46 pares de contraste; além do mínimo (4,5 / 3,0), o script compara cada par com o número do contrato (tolerância 0,02) e falha se divergir. Todos bateram.
- T009: os `unicode-range` dos pacotes `@fontsource-variable/inter` e `outfit` (5.3.0) são idênticos aos de `src/styles.css` (só muda o espaço depois das vírgulas). Pacotes instalados e desinstalados em seguida; `package.json`/lock sem diferença líquida. A `<meta name="theme-color" content="#3A4FD6">` do `index.html` (índigo antigo) não está em nenhuma tarefa da Fundação e ficou como estava.
- **T010, desvio de implementação**: `faro-icons.ts` importa cada glifo por caminho (`@boxicons/js/icons/<Nome>`) e monta o SVG ele mesmo, em vez de usar `createSvgString` do barrel `@boxicons/js`. Motivo: o barrel carrega 4.362 módulos e levou a suíte de testes de 12 s para 86 s (com um teste falhando por tempo). O SVG gerado é o mesmo que `createSvgString` produz (fill `currentColor`, `aria-hidden="true"`), sem `width`/`height`. O resultado do contrato (32 nomes, mesmos glifos) não muda. Nota: `npm i @boxicons/js@1.0.1` gravou `"^1.0.1"` no `package.json` (prefixo padrão do npm; versão instalada 1.0.1). Os testes imprimem avisos "Sourcemap ... points to missing source files" dos glifos do pacote; são ruído e não falha.
- T011, mapa aplicado (Lucide → nome do Faro): `lucideCircleAlert` → `alert` (alert); `lucideLoaderCircle` → `loader` (button); `lucideCheck` → `check` (checkbox); no sonner, `lucideLoader2` → `loader`, `lucideCircleCheck` → `checkCircle`, `lucideOctagonX` → `alert` (erro), `lucideTriangleAlert` → `warn`, `lucideInfo` → `info`; `lucideTrash2` aparecia só num comentário de exemplo de `alert-dialog.component.ts` e virou `warn`. Os cinco `provideIcons`/`viewProviders` locais foram removidos. Nenhum ícone nem token novo foi acrescentado.
- T012: classes de foco removidas por script (tokens com variante `focus`/`focus-visible`/`aria-invalid`/`has-[…aria-invalid…]` e utilitário `ring-*`, `border-ring`, `border-destructive/40`, `outline-*`; mais `outline-none`/`outline-hidden`/`ring-offset-*` em qualquer variante) em `button`, `input`, `input-group`, `textarea`, `checkbox`, `switch`, `toggle`, `badge`, `item`, `input-otp`, `alert-dialog`. Todos os controles que tinham `aria-invalid:ring-*` ficaram com `aria-invalid:border-destructive`. Também saíram, no `input-group`, os `has-[…:focus-visible]` (borda e anel do grupo) e as linhas `[&>…:focus-visible]:ring-0!`. Ficaram de propósito, por serem de tarefas seguintes: `ring-1 ring-foreground/10` do painel do diálogo (T023), `data-active:border-ring data-active:ring-3 data-active:ring-ring/50` da célula do `input-otp` (T024: as três bordas), `ring-0` solto em `input`/`textarea` embutidos em grupo. Observação: utilitários `shadow-*`/`ring-*` ficam na camada `utilities`, que vence a camada `base` onde está a regra global de foco; onde um controle ainda tem `shadow-*` (hoje `checkbox`, que a T019 reescreve) a "folga" em `box-shadow` do foco pode ser sobrescrita, mas o `outline` de 2px continua valendo.
- T013: `optimization` do `production` em `angular.json` com `inlineCritical: false`; depois do build, nenhum `onload=` em `index.csr.html` nem `index.html` (comando da tarefa imprimiu `ok`).
- T014: `@axe-core/playwright` 4.14.0 (axe-core 4.14.1) em `devDependencies`. `rgb()` de `e2e/support/ui.ts` recebe a propriedade em camelCase (`backgroundColor`), como no `getComputedStyle(el)[property]` da tarefa. O arquivo passa em `tsc --strict` isolado (o `ng lint` não cobre `e2e/`).
- T015: `/dev/ui` abre em dev e o `import()` da galeria não entra no build de produção (busca por `dev-gallery` e pelo título nos `.js` de `dist/faro` não acha nada). As rotas `/dev/ui/components` etc. listadas no índice ainda não existem (T029, T041 em diante); os links só são clicáveis a partir daí.

### Checkpoint da Phase 2 (2026-11-21)

| Comando | Resultado |
|---|---|
| `npm run build` | passou (saída 0). Um aviso: orçamento do bundle inicial, 575,23 kB contra 500 kB (PrimeNG ainda instalado; sai na T037) |
| `npm run lint` | passou ("All files pass linting.") |
| `npm test -- --watch=false` | passou: 10 arquivos, 47 testes (44 da linha de base + 3 de `faro-icons.spec.ts`) |
| `npx playwright test e2e/smoke.spec.ts` | passou: 1 teste |
| `npx playwright test e2e/dev-gallery.spec.ts` | passou: 1 teste |
| `npm run check:tokens` | passou: 65 variáveis, 46 pares |

Tamanhos depois da Fase 2 (`dist/faro/browser/`): soma dos `.js` sem scripts do service worker 957.861 bytes (linha de base: 936.345); soma dos `.css` 95.575 bytes (linha de base: 35.752). `ngsw-worker.js` continua no pacote (sai na T057).

### Fase 3 (T016 a T030), desvios e decisões

- **Camada de baixa prioridade para a folha antiga (fora das tarefas, temporário)**: com `src/styles/faro-ds.css` carregada depois de `styles.css` e sem camada, ela sobrescrevia `--primary` (índigo `#3A4FD6`), `--border`, `--divider`, `--text`, `--ring`, `--amber`, o `body`, `h1..h4` (Poppins) e `a`, e vencia as utilidades do Tailwind. Sem isso nenhuma verificação de identidade da T030 passava (o botão `default` saía índigo). Mudança: `angular.json` → `styles` passa a `["primeicons/primeicons.css", "src/styles/faro-ds.css", "src/styles.css"]` e `faro-ds.css` ganha, no topo, `@layer legacy, ng-icon, theme, base, components, utilities;` e todo o conteúdo dentro de `@layer legacy { ... }`. Some tudo na T037 (que apaga o arquivo e fixa `styles` em `["src/styles.css"]`). Efeito colateral: o login antigo (PrimeNG) mudou de aparência até a Fase 4 (as variáveis `--primary`, etc. agora são as novas).
- **T016**: `zSize` vem antes de `zType` em `button.variants.ts` para o tipo `link` (`h-auto`, `px-0`) vencer o tamanho no `tailwind-merge`; `zLoading`/`zDisabled` por último. `zShape.default` virou vazio (o padrão do ZardUI `rounded-md` anulava a pílula). Edição no componente: `aria-busy` e `disabled` também quando `zLoading`. Tipos `xs`, `icon-xs`, `icon-sm`, `icon-lg` e `accent`/`whatsapp` não existem.
- **Área de toque medida**: o `inset` do `before`/`after` conta a partir da caixa de preenchimento, que é 2px menor que a altura (a borda de 1,5px vira 1px com DPR 1). Por isso: botão `sm` usa `before:-inset-y-1.5`, chip usa `after:-inset-y-[5px]`, caixa usa `after:-inset-3.5` (o contrato dizia `-inset-y-1`, `-inset-y-[3px]`/`-inset-3`, que davam 41 a 42px). Verificado no e2e.
- **T018**: `fieldSuccessVariants` acrescentado em `field.variants.ts` (o Zard não tem estado de sucesso). `field-label` perdeu `has-data-checked:border-primary/…` (lima como seleção é proibido).
- **T020**: `toggle` ganhou o tipo `segmented` e `toggle-group` a trilha (`data-[variant=segmented]:…`) e o input `zAriaLabel`; no modo `single` tocar na opção escolhida não a desmarca (sempre há uma escolhida). `badge` ganhou `zSize` e o padrão de `zType` virou `neutral`. Removidas as regras de grupo "emendado" (`zSpacing=0`) e os tamanhos `sm`/`lg` do chip (só existe `default`).
- **T021**: `card` ficou `p-4 gap-3` (sem `--card-spacing` nem `px` nas partes; o componente passou a repassar `zSize` ao `cva`). `item-group` perdeu `role="list"` (o axe reprovava: filhos `a`, `separator` e `switch` não são `listitem`). `item` ficou só `default`.
- **T022**: tipos do `alert` renomeados `default→neutral`, `destructive→danger` (+ `success`); ícone e `role` por tipo (neutro e sucesso `status`, erro `alert`). `spinner` passou a usar o ícone `loader` do Faro (não mais o SVG do Zard) e o texto padrão `Carregando`; o tamanho usa `size-4!` porque o estilo do host do `ng-icon` não está em camada e vence `size-*` (para outro tamanho, `size-12!`).
- **T023**: o seletor do aviso temporário é `z-sonner` (não `z-toaster`); a seção traz `<z-sonner />`; `app.html` intacto. `theme` padrão do sonner virou `light` e as cores vêm de `--toast`; `!` nas utilidades porque o CSS do ngx-sonner não está em camada. Textos padrão em inglês do diálogo (`Cancel`, `Continue`, `Confirm`) viraram `$localize` em PT-BR; o cancelar do diálogo é `ghost`.
- **T024**: em vez de editar o padrão do arquivo copiado, o `input-otp` ganhou `zMode` (`numeric` | `alphanumeric`), que escolhe o padrão (`REGEXP_ONLY_DIGITS_AND_CHARS`), `inputmode`, `autocapitalize` e `autocomplete`; também `zAriaLabel` (grupo) e os atributos `data-filled`/`data-active` nas células (sem `slots`). Sem normalização: `O1IL2M` fica como foi digitado. Rótulos das células em PT-BR. Os tamanhos `sm`/`lg` do `input-otp` saíram.
- **T025**: a busca por `/logos/` em `src/` ainda acha `features/auth/login/login.html` (login antigo, reescrito na T031/T032). Só `brand-assets.ts` está certo nos arquivos desta fase; a parte "só acha brand-assets.ts" do "Feito quando" só fecha depois da T032. O `path` do focinho foi copiado por script do `logo-compact.svg` atual (1 `<path>`).
- **T028**: o nome do `app-pet-hero` é um `<h1>` (o contrato não diz o elemento). Se a tela já tiver `h1`, ajustar na spec 003; a confirmar com o William.
- **T029**: os `data-testid` internos das seções usam o prefixo `dev-` e só a raiz de cada seção começa por `gallery-` (senão o teste "12 elementos com `gallery-`" contaria dezenas).
- **T030**: no e2e, as leituras de cor usam `expect.poll` e a página espera o `body` ficar `rgb(247, 248, 248)`: em dev o CSS chega depois do primeiro desenho e as cores (com `transition-colors`) eram lidas no meio da transição (testes intermitentes). A checagem de alvo de toque mede o pseudo-elemento (`before`/`after` absolutos) quando a caixa tem menos de 44px.
- Regras de lint: nenhuma regra nova desligada nesta fase.

### Checkpoint da Phase 3 (2026-11-21)

| Comando | Resultado |
|---|---|
| `npm run build` | passou; um aviso: orçamento do bundle inicial, 567,85 kB contra 500 kB (PrimeNG ainda instalado; sai na T037) |
| `npm run lint` | passou ("All files pass linting.") |
| `npm test -- --watch=false` | passou: 40 arquivos, 181 testes |
| `npx playwright test e2e/smoke.spec.ts` | passou (rodado junto com `dev-gallery` e `ui-identity`: 18 testes, 4 rodadas seguidas verdes depois das correções de intermitência) |
| `npx playwright test e2e/ui-identity.spec.ts` | passou: 15 testes (celular, desktop, 320px; axe sem violações graves) |
| `npm run check:ui` | passou: 65 variáveis, 46 pares |

## Regras de lint desligadas

Bloco em `eslint.config.js` com `files` = `src/app/shared/core/**/*.ts`, `src/app/shared/utils/**/*.ts`, `src/app/shared/components/**/*.ts` e `ignores` = `src/app/shared/components/faro/**`:

- `@angular-eslint/component-selector`: off (30 ocorrências no código copiado) — T006
- `@angular-eslint/directive-selector`: off (4 ocorrências) — T006
- `@typescript-eslint/array-type`: off (1: `field.component.ts`, `ReadonlyArray<T>`) — T006
- `@typescript-eslint/no-unused-vars`: off (1: `string-template-outlet.directive.ts`, `_ctx` usado só como tipo) — T006

Nenhuma regra de acessibilidade de template foi acusada; `no-restricted-globals` (`localStorage`) continua ligada.

## Resultado final

(a preencher no fim da spec)
