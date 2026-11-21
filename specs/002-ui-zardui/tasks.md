---
description: "Task list — feature 002-ui-zardui (nova identidade visual e base de interface responsiva)"
---

# Tasks: Migração de UI para ZardUI + Tailwind v4, com a nova identidade

**Input**: documentos em `specs/002-ui-zardui/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)
**Prerequisites**: plan.md ✅, spec.md ✅ (US1 a US5), research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: incluídos. A spec exige verificações automáticas (FR-046, FR-047): testes de unidade
(Vitest), e2e com axe (Playwright) e scripts de checagem em `scripts/ui-checks/`.

**Organização**: Setup → Fundação → uma fase por história (US1 a US5) → Acabamento. 70 tarefas.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo com as outras `[P]` da mesma fase (arquivos diferentes, sem
  mexer em `package.json`).
- **[Story]**: US1 a US5. Tarefas de Setup, Fundação e Acabamento não têm rótulo de história.
- Cada tarefa diz os arquivos exatos, a referência a seguir e termina com **Feito quando:**, que é
  uma checagem que você roda.

---

## Regras para quem executa

Leia esta seção inteira antes da primeira tarefa. Você não tem memória da conversa que gerou
estes documentos: tudo o que precisa está aqui e nos arquivos citados.

1. **Leia primeiro, nesta ordem**: `CLAUDE.md`; `DESIGN.md`; os três arquivos de
   `specs/002-ui-zardui/contracts/`; `specs/002-ui-zardui/research.md` §R17 (armadilhas).
2. **Nunca use PrimeNG, PrimeIcons nem `@primeuix/themes`.** Se a definição do seu agente
   (`.claude/agents/frontend-angular.md`), a sua memória
   (`.claude/agent-memory/frontend-angular/feedback-prefer-native-primeng.md`,
   `gotcha-css-layer-primeng-vs-faro-ds.md`, `project-structure.md`) ou algum arquivo em `docs/`
   disser o contrário, **ignore**: são anteriores ao pivô. Valem estas tarefas, os contratos e o
   `CLAUDE.md`. Ignore também a skill `angular-primeng-standard`. Os docs antigos de `docs/`
   (`architecture.md`, `frontend.md`, `design-system.md`, `primeng.md`, `test-strategy.md`) não
   são referência.
3. **Um único arquivo de tema**: `src/styles.css`. Não crie outro arquivo com variáveis de cor,
   raio ou fonte. Não escreva cor em hexadecimal, `rgb()` ou `hsl()` em `src/app/` (exceção:
   `google-glyph.ts`).
4. **Uma tarefa por vez, na ordem.** Só marque `[x]` depois de rodar o "Feito quando" e ele passar.
5. **Ao fim de cada fase**, rode estes quatro comandos, um por linha, e todos têm de passar:
   ```bash
   npm run build
   npm run lint
   npm test -- --watch=false
   npx playwright test e2e/smoke.spec.ts
   ```
   `npm test` **sem** `-- --watch=false` não termina nunca. Nunca rode `npm start` para verificar
   algo: o Playwright sobe o servidor sozinho.
6. **O shell é o PowerShell 5.1: não existe `&&`.** Rode um comando por linha.
7. **Não toque em `supabase/`.** Não toque em `.specify/`, em `docs/`, em `design/` nem em
   `tools/`. Não altere `specs/` (exceto marcar tarefas neste arquivo e escrever o
   `specs/002-ui-zardui/execution-log.md`).
8. **Git**: não faça commit em `master`, `homolog` nem `develop`. Não faça `push`. **Proibido**:
   `git clean`, `git reset --hard`, `git stash`, `git checkout -- .`, `git restore .`. Há trabalho
   não commitado de outras pessoas na árvore. Commits, se o William pedir, usam o padrão
   `:emoji: tipo: descrição` do repositório.
9. **Pare e reporte em vez de improvisar** quando: um contrato for ambíguo ou contradisser outro;
   um componente copiado do ZardUI não permitir o resultado pedido; um comando de verificação
   falhar por motivo que você não resolve em 30 minutos; uma tarefa pedir para apagar algo que não
   está na seção "Arquivos removidos". "Reportar" é escrever o que aconteceu (comando, saída do
   erro, o que tentou) em `specs/002-ui-zardui/execution-log.md` e encerrar.
10. **Componentes do ZardUI**: o contrato fixa o **resultado**. A API (seletor, nomes dos
    `input()`, nome da classe exportada) é a do código copiado. Antes de usar um componente, abra
    `src/app/shared/components/<nome>/<nome>.component.ts`, `<nome>.variants.ts` e `index.ts`.
11. **Não rode**: `zard-cli add dark-mode`, `add sidebar`, `add typeset`, `add --all`, nem
    `add <nome> --overwrite` sobre um componente já editado. Use sempre `zard-cli@1.12.0`.
12. **Não instale dependência que não esteja citada numa tarefa.**
13. **Registre no `execution-log.md`** todo desvio do contrato, toda regra de lint desligada e
    todo token ou ícone acrescentado.
14. Textos de interface em PT-BR, sem emoji. Código e nomes de pasta em inglês.

---

## Arquivos removidos

O William precisa ver esta lista antes da implementação. Nada fora dela é apagado.

**Tema e estilos da identidade antiga** (tarefa T037)

| Arquivo | Por quê |
|---|---|
| `src/theme/faro-preset.ts` | preset do PrimeNG (a pasta `src/theme/` some) |
| `src/styles/faro-ds.css` | tokens e classes `.f-*` antigos |
| `src/styles/faro-shells.css` | cascas do guia de estilo antigo, nunca usadas no app |
| `src/styles/README.md` | documentação dos dois arquivos acima (a pasta `src/styles/` some) |
| `src/app/features/auth/login/login.css` | o login passa a usar classes do Tailwind (T031) |
| `src/app/features/pets/pets/pets.css` | a tela provisória passa a usar classes do Tailwind (T036) |

**Stubs do roadmap e barrel vazio** (tarefa T002)

| Arquivo | Por quê |
|---|---|
| `src/app/features/health-records/index.ts` | saúde é roadmap (a pasta some) |
| `src/app/features/reminders/index.ts` | lembretes são roadmap (a pasta some) |
| `src/app/features/subscription/index.ts` | assinatura é roadmap (a pasta some) |
| `src/app/shared/index.ts` | barrel vazio cujo comentário fala em "wrappers PrimeNG"; nada o importa |

**Service worker** (tarefa T057)

| Arquivo | Por quê |
|---|---|
| `ngsw-config.json` | configuração do service worker |

**Ícones genéricos do início do projeto** (tarefa T060)

| Arquivo | Por quê |
|---|---|
| `public/icons/icon-72x72.png` | tamanho que o manifest novo não usa |
| `public/icons/icon-96x96.png` | idem |
| `public/icons/icon-128x128.png` | idem |
| `public/icons/icon-144x144.png` | idem |
| `public/icons/icon-152x152.png` | idem |
| `public/icons/icon-384x384.png` | idem |

**Memória obsoleta do agente `frontend-angular`** (tarefa T067; só se ainda existirem)

| Arquivo | Por quê |
|---|---|
| `.claude/agent-memory/frontend-angular/feedback-prefer-native-primeng.md` | manda preferir PrimeNG |
| `.claude/agent-memory/frontend-angular/gotcha-css-layer-primeng-vs-faro-ds.md` | trata de `@layer primeng` e `faro-ds.css`, que deixam de existir |

**Sobrescritos, não removidos**: `src/styles.css`, `public/favicon.ico`,
`public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`, `public/manifest.webmanifest`.

**Dependências desinstaladas**: `primeng`, `@primeuix/themes`, `primeicons` (T037);
`@angular/service-worker` (T057); `@ng-icons/lucide` (entra em T004, sai em T011);
`@fontsource-variable/inter` e `@fontsource-variable/outfit` (entram e saem em T009).

**Ficam, de propósito**: `public/logos/logo-compact2.svg` e `logo-full-light2.svg` (versões para
fundo lima, sem uso no código); os arquivos `.css` vazios `src/app/app.css`,
`features/public/landing/landing.css`, `features/public/rescue-page/rescue-page.css` e
`features/admin/admin/admin.css`; `docs/primeng.md` e os demais docs antigos (a limpeza de `docs/`
é outra etapa do pivô).

---

## Phase 1: Setup

**Objetivo**: saber de onde se parte e tirar o que é roadmap.

- [x] T001 Conferir o ponto de partida e medir a linha de base; criar `specs/002-ui-zardui/execution-log.md`
  - **Faça**:
    1. `git branch --show-current`. Se a resposta for `master`, `homolog` ou `develop`: **PARE e
       reporte**. A branch esperada é `002-ui-zardui` (ou a que o William deixou preparada).
    2. `git status --short`. Copie a saída para o log. **Não limpe nada.**
    3. Rode, um por linha: `npm run build`, `npm run lint`, `npm test -- --watch=false`,
       `npx playwright test e2e/smoke.spec.ts`. Se o Playwright reclamar de navegador, rode
       `npx playwright install chromium` e repita. **Se algum falhar antes de qualquer mudança,
       PARE e reporte.**
    4. Meça os tamanhos:
       `node -e "const fs=require('fs');const d='dist/faro/browser/';for(const f of fs.readdirSync(d))if(/\.(js|css|html)$/.test(f))console.log(f,fs.statSync(d+f).size)"`
    5. Crie `specs/002-ui-zardui/execution-log.md` com as seções: `## Linha de base` (branch,
       `git status`, resultado dos quatro comandos, tabela de tamanhos, soma dos `.js` e dos
       `.css`), `## Spike`, `## Desvios e decisões`, `## Regras de lint desligadas`,
       `## Resultado final`.
  - **Feito quando**: o arquivo existe, os quatro comandos estão registrados como aprovados e a
    tabela de tamanhos está preenchida.

- [x] T002 [P] Remover os stubs do roadmap: `src/app/features/health-records/index.ts`, `src/app/features/reminders/index.ts`, `src/app/features/subscription/index.ts`, `src/app/shared/index.ts`
  - **Faça**: apague os quatro arquivos (e as três pastas de feature, que ficam vazias). Em
    `src/app/models/index.ts`, troque o comentário para
    `// models/ — tipos e DTOs do domínio (Pet, TagCode, TagAssignment, RescueProfile, ScanEvent).`
    Confirme antes, com uma busca em `src/`, que nenhum arquivo importa `shared/index`,
    `health-records`, `reminders` ou `subscription` (a única ocorrência de "subscription" é um
    mock em `core/auth/auth.service.spec.ts`, que **não** é esta pasta: deixe).
  - **Feito quando**: `npm run build` e `npm run lint` passam e `src/app/features/` contém só
    `admin`, `auth`, `pets` e `public`.

**Checkpoint**: linha de base registrada; projeto verde.

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Objetivo**: Tailwind, ZardUI, tema, fontes, ícones e a galeria de desenvolvimento. PrimeNG
**continua instalado** nesta fase; ele sai na US2.

**⚠️ CRÍTICO**: nenhuma história começa antes do checkpoint desta fase.

- [x] T003 **Spike de compatibilidade ZardUI × Angular 21, numa cópia de trabalho separada. Tem condição de PARADA.**
  - **Referência**: `research.md` §R1 e §R2.
  - **Faça** (um comando por linha; a pasta `../faro-spike-002` fica **fora** do repositório; se
    ela já existir, PARE e reporte):
    ```bash
    git worktree add ../faro-spike-002 -b spike/002-zardui
    cd ../faro-spike-002
    npm ci
    npx zard-cli@1.12.0 init --yes --type angular --css src/styles.css --app-config src/app/app.config.ts --base-color neutral --no-rtl
    npx zard-cli@1.12.0 add button input field checkbox alert-dialog sonner input-otp --yes
    npm i @boxicons/js@1.0.1
    npm ls @angular/core @angular/cdk @ng-icons/core
    ```
    Depois, **só na cópia**: em `src/app/features/public/landing/landing.ts` e `landing.html`,
    acrescente um botão do ZardUI com a classe `bg-primary` (abra
    `src/app/shared/components/button/index.ts` para saber o nome a importar). Então:
    ```bash
    npx ng build
    npx ng test --watch=false
    npx ng lint
    ```
  - **Registre em `execution-log.md`, seção `## Spike`** (o arquivo está na pasta principal, não
    na cópia):
    1. versões instaladas de `@angular/cdk`, `@ng-icons/core`, `@ng-icons/lucide`, `tailwindcss`,
       `@tailwindcss/postcss`, `tailwindcss-animate`, `class-variance-authority`, `ngx-sonner`;
    2. `git status --short` da cópia logo depois do `init` (lista de arquivos criados e alterados);
    3. para cada um dos 7 componentes: classe exportada, seletor e nomes dos `input()` de variante;
    4. erros do `ng lint` em código copiado, agrupados por nome de regra;
    5. se `src/app/shared/core/css/zard.css` declara alguma variável (`--algo:`), e quais;
    6. **onde o diálogo é anexado**: procure em `src/app/shared/core/overlay/` e em
       `src/app/shared/components/alert-dialog/` por `OverlayContainer`, `cdk-overlay-container`
       ou `document.body`; anote o elemento e como obtê-lo por código;
    7. quais símbolos `lucide*` os componentes importam;
    8. se o CSS de `dist/faro/browser/styles-*.css` contém a regra da classe `bg-primary`.
  - **Condições de PARADA** (se qualquer uma ocorrer: escreva no log o comando e a saída
    completa, **não tente alternativa** — não mude de biblioteca, não suba o Angular, não rebaixe
    o Tailwind — e encerre):
    1. algum `npm ci`/`npm i`/`zard-cli` só funciona com `--force` ou `--legacy-peer-deps`, ou
       `npm ls` mostra `invalid`/`ERESOLVE`;
    2. o `zard-cli add` recusa algum componente por versão do Angular;
    3. `npx ng build` falha por causa de ZardUI, Tailwind, PostCSS ou CDK e não se resolve em 30
       minutos editando arquivos do próprio projeto;
    4. `npx ng test --watch=false` passa a falhar em testes que passavam na linha de base;
    5. o `init` criou ou alterou arquivo fora desta lista: `components.json`, `.postcssrc.json`,
       `package.json`, `package-lock.json`, `tsconfig.json`, `src/app/app.config.ts`,
       `src/styles.css`, `src/app/shared/core/**`, `src/app/shared/utils/**`;
    6. algum arquivo copiado importa pacote fora de: `@angular/*`, `@ng-icons/core`,
       `@ng-icons/lucide`, `class-variance-authority`, `clsx`, `tailwind-merge`, `ngx-sonner`,
       `rxjs`, caminhos relativos e `@/…`.
    Erros de **lint** em código copiado do ZardUI **não** são motivo de parada: anote (a T006
    resolve).
  - **Limpeza** (sempre, tendo aprovado ou parado):
    ```bash
    cd ../pet-app
    git worktree remove ../faro-spike-002 --force
    git branch -D spike/002-zardui
    ```
    (Ajuste o `cd` para voltar à pasta principal do repositório.)
  - **Feito quando**: a seção `## Spike` do log termina com `Resultado: APROVADO` e os oito itens
    preenchidos, e `git worktree list` mostra só a pasta principal.

- [x] T004 Inicializar o ZardUI e o Tailwind na branch de trabalho (`components.json`, `.postcssrc.json`, `tsconfig.json`, `src/app/app.config.ts`, `src/styles.css`, `src/app/shared/core/`, `src/app/shared/utils/`)
  - **Faça**:
    ```bash
    npx zard-cli@1.12.0 init --yes --type angular --css src/styles.css --app-config src/app/app.config.ts --base-color neutral --no-rtl
    git status --short
    ```
    O `init` **sobrescreve** `src/styles.css` (hoje só tem um comentário) e acrescenta
    `provideZard()` em `app.config.ts`. **Não** mexa em `angular.json` nem tire nada do PrimeNG
    agora.
  - **Feito quando**: `git status --short` só mostra, além do que já estava na linha de base, os
    arquivos da lista da condição de parada 5 da T003; `npm run build` e
    `npm test -- --watch=false` passam.

- [x] T005 Copiar os componentes do ZardUI para `src/app/shared/components/` e revisar o que entrou
  - **Referência**: `contracts/shared-components.contract.md` §3; `research.md` §R2 (risco do
    registro remoto).
  - **Faça**:
    ```bash
    npx zard-cli@1.12.0 add button input textarea field checkbox switch toggle toggle-group badge alert alert-dialog card item empty sonner spinner skeleton input-otp --yes
    npm audit --audit-level=high
    ```
    Depois **leia o diff inteiro** dos arquivos copiados. Liste todos os especificadores de
    `import` de `src/app/shared/**/*.ts` que não começam com `.` nem com `@/` e confira contra a
    lista permitida da T003 (condição 6). Pacote fora da lista: **PARE e reporte**. Se o
    `npm audit` apontar vulnerabilidade alta ou crítica em pacote instalado nesta feature:
    **PARE e reporte**; se for em pacote que já existia, só anote.
  - **Feito quando**: existem as pastas `button`, `input`, `textarea`, `field`, `checkbox`,
    `switch`, `toggle`, `toggle-group`, `badge`, `alert`, `alert-dialog`, `card`, `item`, `empty`,
    `sonner`, `spinner`, `skeleton` e `input-otp` em `src/app/shared/components/`; a lista de
    pacotes importados está no log; `npm run build` passa.

- [x] T006 Exceção de ESLint para o código copiado do ZardUI em `eslint.config.js`
  - **Faça**: logo depois do primeiro bloco `files: ['**/*.ts']`, acrescente um bloco com
    `files: ['src/app/shared/core/**/*.ts', 'src/app/shared/utils/**/*.ts', 'src/app/shared/components/**/*.ts']`,
    `ignores: ['src/app/shared/components/faro/**']` e as regras
    `'@angular-eslint/component-selector': 'off'` e `'@angular-eslint/directive-selector': 'off'`.
    Rode `npm run lint`. Para cada erro que sobrar **em código copiado**:
    - se for de TypeScript de estilo (por exemplo `no-empty-function`, `no-explicit-any`),
      desligue a regra **só nesse bloco**;
    - se for de acessibilidade de template (`@angular-eslint/template/...`), corrija o template
      copiado quando for simples; se não for, desligue a regra só para
      `src/app/shared/components/<nome>/**` (um bloco com `files` terminando em `**/*.html` e
      outro em `**/*.ts`);
    - **não** desligue `no-restricted-globals` (o `localStorage`): se o código copiado usa
      `localStorage`, PARE e reporte.
    Anote cada regra desligada em `## Regras de lint desligadas`. Não edite o código do ZardUI só
    para satisfazer regra de estilo.
  - **Feito quando**: `npm run lint` passa.

- [x] T007 Escrever o tema do Faro em `src/styles.css`
  - **Referência**: `contracts/design-tokens.contract.md` §3 (o bloco é o arquivo inteiro).
  - **Faça**: substitua o conteúdo de `src/styles.css` pelo bloco do contrato. **Mantenha a linha
    `@import` do `zard.css` exatamente como o `init` escreveu** (se o caminho for diferente do
    bloco, vale o do `init`). Abra `src/app/shared/core/css/zard.css`: se ele declarar alguma
    variável das tabelas da seção 2 do contrato, apague a declaração de lá e anote no log.
    Se o build recusar `source('.')`, use
    `@import 'tailwindcss' source(none);` seguido de `@source './app';` e `@source './index.html';`
    e anote.
  - **Feito quando**: `npm run build` passa; `src/styles.css` não contém `oklch`; e este comando
    imprime `ok`:
    `node -e "const fs=require('fs');const d='dist/faro/browser/';const c=fs.readdirSync(d).filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(d+f,'utf8')).join('');if(!/#84c32e/i.test(c))throw new Error('lima ausente');if(/0FA12E/i.test(c))throw new Error('Tailwind varreu fora de src');console.log('ok')"`

- [x] T008 Criar a checagem de tokens `scripts/ui-checks/tokens.mjs` e os scripts `check:tokens` e `check:ui` em `package.json`
  - **Referência**: `contracts/design-tokens.contract.md` §2 (valores) e §5 (pares).
  - **Faça**: script de Node sem dependências que:
    1. lê `src/styles.css` e extrai as declarações `--nome: valor;` do bloco `:root { … }` e do
       bloco `.dark { … }`; o tema escuro é o claro com as substituições de `.dark`;
    2. confere que **cada variável das tabelas §2.1 e §2.2** existe com o valor do contrato (claro
       e escuro; comparação de hexadecimal sem diferenciar maiúsculas); os valores esperados
       ficam em dois objetos no próprio script;
    3. confere que `.dark` **não** redefine `--primary`, `--primary-foreground`, `--ink`,
       `--brand`, `--lost`, `--amber`, `--destructive`, `--toast`;
    4. calcula o contraste WCAG 2.1 de cada par da §5 nos dois temas (mínimo 4,5 para a tabela de
       texto e 3,0 para a de controles). Fórmula: para cada canal `c/255`,
       `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`; luminância
       `0.2126·R + 0.7152·G + 0.0722·B`; contraste `(maior+0.05)/(menor+0.05)`;
    5. imprime uma tabela com o resultado de cada par e sai com código 1 se algo falhar.
    Em `package.json`, acrescente `"check:tokens": "node scripts/ui-checks/tokens.mjs"` e
    `"check:ui": "npm run check:tokens"`.
  - **Feito quando**: `npm run check:tokens` sai com código 0 e os números impressos batem com a
    tabela da §5 (diferença de até 0,02).

- [x] T009 Fontes no próprio domínio: `public/fonts/` e `src/index.html`
  - **Referência**: `research.md` §R7; `contracts/design-tokens.contract.md` §3 (os `@font-face`
    já estão no bloco da T007).
  - **Faça** (um comando por linha):
    ```bash
    npm i -D @fontsource-variable/inter@5.3.0 @fontsource-variable/outfit@5.3.0
    node -e "const fs=require('fs');fs.mkdirSync('public/fonts',{recursive:true});for(const [p,f] of [['inter','inter-latin-wght-normal'],['inter','inter-latin-ext-wght-normal'],['outfit','outfit-latin-wght-normal'],['outfit','outfit-latin-ext-wght-normal']])fs.copyFileSync('node_modules/@fontsource-variable/'+p+'/files/'+f+'.woff2','public/fonts/'+f+'.woff2')"
    node -e "const fs=require('fs');fs.writeFileSync('public/fonts/OFL.txt',['inter','outfit'].map(p=>'=== '+p+' ===\n'+fs.readFileSync('node_modules/@fontsource-variable/'+p+'/LICENSE','utf8')).join('\n\n'))"
    ```
    Antes de desinstalar, compare os `unicode-range` dos blocos `latin` e `latin-ext` de
    `node_modules/@fontsource-variable/inter/wght.css` e `…/outfit/wght.css` com os de
    `src/styles.css`; se forem diferentes, use os do pacote e anote. Então:
    ```bash
    npm rm @fontsource-variable/inter @fontsource-variable/outfit
    ```
    Em `src/index.html`: apague o comentário das fontes e as três linhas do Google Fonts (os dois
    `preconnect` e o `stylesheet`) e, no lugar, ponha:
    ```html
    <link rel="preload" href="fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="fonts/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
    ```
  - **Feito quando**: `public/fonts/` tem os quatro `.woff2` e o `OFL.txt`; `src/index.html` não
    contém `googleapis` nem `gstatic`; `package.json` não contém `fontsource`; `npm run build`
    passa.

- [x] T010 Registro de ícones: `src/app/shared/icons/faro-icons.ts`, `src/app/shared/icons/faro-icons.spec.ts`, `src/app/app.config.ts`
  - **Referência**: `contracts/shared-components.contract.md` §2 (tabela com os 32 nomes).
  - **Faça**: `npm i @boxicons/js@1.0.1`. Crie `faro-icons.ts` com a função `svg`, o objeto
    `faroIcons` com as 32 entradas da tabela (o `whats` usa `{ pack: 'brands' }`) e
    `export type FaroIconName = keyof typeof faroIcons;`. Em `app.config.ts`, acrescente
    `provideIcons(faroIcons)` (de `@ng-icons/core`) aos `providers`. Crie o teste: há exatamente
    32 chaves; cada valor contém `<svg` e `viewBox`; nenhum valor contém ` width="` nem
    ` height="`.
  - **Feito quando**: `npm test -- --watch=false` e `npm run build` passam; `npm ls @ng-icons/core`
    mostra 34.x.

- [x] T011 Trocar os ícones Lucide dos componentes copiados pelos nomes do Faro e desinstalar `@ng-icons/lucide`
  - **Referência**: `contracts/shared-components.contract.md` §2 (mapa `lucide*` → nome do Faro).
  - **Faça**: procure `@ng-icons/lucide` em `src/`. Em cada arquivo: remova o import, remova o
    `provideIcons({...})` local (em `providers` ou `viewProviders`) e troque o `name="lucide…"`
    pelo nome do Faro. Se um símbolo não tiver equivalente na tabela, acrescente o glifo do
    Boxicons em `faro-icons.ts` (e ajuste o número no teste da T010), acrescente a linha na
    tabela do contrato e anote no log. Depois: `npm rm @ng-icons/lucide`.
  - **Feito quando**: a busca por `lucide` (sem diferenciar maiúsculas) em `src/` não acha nada;
    `package.json` não contém `lucide`; `npm run build`, `npm run lint` e
    `npm test -- --watch=false` passam.

- [x] T012 Tirar as classes de foco dos componentes copiados (`src/app/shared/components/**/*.variants.ts` e `*.component.ts`, exceto `faro/`)
  - **Referência**: `contracts/design-tokens.contract.md` §4.
  - **Faça**: remova das cadeias de classes toda ocorrência de `focus-visible:ring-…`,
    `focus:ring-…`, `focus-visible:border-ring`, `focus-visible:outline-…`, `ring-offset-…`,
    `outline-none`, `outline-hidden` e `aria-invalid:ring-…`. Onde havia `aria-invalid:ring-…`,
    garanta `aria-invalid:border-destructive`. O foco passa a ser o da regra global de
    `src/styles.css`.
  - **Feito quando**: a busca pela expressão
    `focus-visible:ring|focus:ring|outline-none|outline-hidden|aria-invalid:ring|ring-offset-` em
    `src/app/shared/` não acha nada; `npm run build` passa.

- [x] T013 [P] Desligar o CSS crítico embutido em produção (`angular.json`)
  - **Referência**: `research.md` §R9.
  - **Faça**: em `projects.faro.architect.build.configurations.production`, acrescente
    `"optimization": { "scripts": true, "styles": { "minify": true, "inlineCritical": false }, "fonts": false }`.
  - **Feito quando**: depois de `npm run build`, este comando imprime `ok`:
    `node -e "const fs=require('fs');for(const f of ['dist/faro/browser/index.csr.html','dist/faro/browser/index.html']){if(fs.readFileSync(f,'utf8').includes('onload='))throw new Error('onload em '+f)}console.log('ok')"`

- [x] T014 Apoio dos testes e2e: `e2e/support/ui.ts` e a dependência `@axe-core/playwright`
  - **Faça**: `npm i -D @axe-core/playwright`. Crie `e2e/support/ui.ts` exportando:
    - `WIDTHS = { narrow: { width: 320, height: 700 }, phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } }`;
    - `expectNoHorizontalScroll(page)`: exige
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
    - `expectNoSeriousA11y(page)`: roda `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()`
      e exige que a lista de violações com `impact` `serious` ou `critical` seja vazia (imprime
      `id` e `nodes[].target` das que houver);
    - `rgb(page, selector, property)`: devolve `getComputedStyle(el)[property]`.
  - **Feito quando**: `npx playwright test e2e/smoke.spec.ts` passa e `e2e/support/ui.ts` existe.

- [ ] T015 Esqueleto da galeria de desenvolvimento: `src/app/features/dev-gallery/dev-gallery.routes.ts`, `src/app/features/dev-gallery/gallery-index/gallery-index.ts`, `src/app/app.routes.ts`, `e2e/dev-gallery.spec.ts`
  - **Referência**: `contracts/shells.contract.md` §7 e §8; `research.md` §R14.
  - **Faça**: crie `DEV_GALLERY_ROUTES` (por enquanto só `{ path: '', loadComponent: GalleryIndex }`)
    e o componente `app-gallery-index` com `data-testid="dev-gallery"`, um `<h1>` "Galeria de
    desenvolvimento" e uma lista de links para as páginas da tabela do contrato §8. Em
    `app.routes.ts`, **antes** das rotas `:codigo/perdido` e `:codigo`, acrescente
    `...(ngDevMode ? [{ path: 'dev/ui', loadChildren: () => import('./features/dev-gallery/dev-gallery.routes').then((m) => m.DEV_GALLERY_ROUTES) }] : []),`.
    O `import()` tem de ficar **dentro** do ramo do `ngDevMode`. Crie `e2e/dev-gallery.spec.ts`:
    abre `/dev/ui` e espera `[data-testid="dev-gallery"]` visível.
  - **Feito quando**: `npx playwright test e2e/dev-gallery.spec.ts` passa; `npm run build` e
    `npm run lint` passam.

**Checkpoint**: rode os quatro comandos da regra 5. Tailwind, ZardUI, tema, fontes e ícones
prontos; PrimeNG ainda presente.

---

## Phase 3: User Story 1 — Reconhecer o mesmo Faro em toda tela (P1) 🎯 MVP

**Goal**: todos os componentes com a identidade nova, visíveis na galeria e conferidos por teste.

**Independent Test**: abrir `/dev/ui/components` e rodar `npx playwright test e2e/ui-identity.spec.ts`
e `npm run check:tokens`.

Cada tarefa de componente tem três partes: (1) editar as variantes conforme o contrato;
(2) um teste de unidade ao lado do arquivo; (3) uma seção de exemplo em
`src/app/features/dev-gallery/sections/<nome>-section.ts` (componente `app-gallery-<nome>`, com
`data-testid="gallery-<nome>"`), mostrando todas as variantes e estados. A T029 junta as seções.

- [ ] T016 [US1] Botão: `src/app/shared/components/button/button.variants.ts`, `button.variants.spec.ts`, `src/app/features/dev-gallery/sections/button-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.1 (base, tabela de `zType`,
    tabela de `zSize`).
  - **Faça**: reescreva a base e as variantes como no contrato; acrescente `ink`, `danger`, `md` e
    `rescue`; não crie `accent` nem `whatsapp`. Ajuste os tipos exportados. O estado de
    carregamento usa o ícone `loader`. Teste: para cada `zType` e `zSize`, a função de variantes
    devolve uma cadeia que contém as classes-chave do contrato (`bg-primary`, `bg-ink`, `h-14`,
    `h-15`, `size-11`…) e nenhuma contém `ring-`. Seção: todos os tipos × tamanhos, desativado e
    carregando.
  - **Feito quando**: `npm test -- --watch=false` e `npm run build` passam.

- [ ] T017 [P] [US1] Quadrado de ícone, cartão de informação e nota: `src/app/shared/components/faro/icon-tile/icon-tile.ts`, `faro/info-card/info-card.ts`, `faro/note/note.ts` (+ um `.spec.ts` para cada) e `sections/info-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §1, §5.6, §5.7, §5.8.
  - **Feito quando**: os testes conferem as classes por `tone`, o `aria-hidden` do ícone e a
    projeção de conteúdo; `npm test -- --watch=false` passa.

- [ ] T018 [P] [US1] Campo: `src/app/shared/components/field/`, `input/`, `textarea/` (arquivos `*.variants.ts`), um `*.variants.spec.ts` em cada e `sections/form-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.2.
  - **Faça**: campo de 54px, raio 12, borda de 1,5px em `border-input`, `text-base`; rótulo acima;
    ajuda, erro e sucesso abaixo. Seção: campo normal, com ajuda, inválido (com
    `aria-describedby`), com sucesso, desativado, área de texto e o **padrão de campo de senha**
    (botão de olho de 44px).
  - **Feito quando**: os testes conferem `h-[54px]`, `border-input`, `text-base` e
    `aria-invalid:border-destructive`; `npm test -- --watch=false` e `npm run build` passam.

- [ ] T019 [P] [US1] Caixa e interruptor: `src/app/shared/components/checkbox/`, `switch/` (`*.variants.ts` + `*.variants.spec.ts`) e `sections/toggles-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.3.
  - **Feito quando**: os testes conferem que o estado ligado usa `bg-foreground` (nunca
    `bg-primary`) e a borda desligada usa `border-input`; `npm test -- --watch=false` passa.

- [ ] T020 [P] [US1] Selo, chip e segmentado: `src/app/shared/components/badge/`, `toggle/`, `toggle-group/` (`*.variants.ts` + `*.variants.spec.ts`) e `sections/chips-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.4.
  - **Faça**: selo com os tipos `neutral`, `success`, `warning`, `danger`, `ink`, `outline` e os
    tamanhos `default` (24px) e `lg` (32px). Chip solto e escolhido. Segmentado de seleção única.
  - **Feito quando**: os testes conferem as classes de cada tipo e que o estado escolhido usa
    `bg-foreground text-background`; `npm test -- --watch=false` passa.

- [ ] T021 [US1] Cartão, linha de lista e estado vazio: `src/app/shared/components/card/`, `item/`, `empty/` (`*.variants.ts` + `*.variants.spec.ts`) e `sections/lists-section.ts` (depende de T017)
  - **Referência**: `contracts/shared-components.contract.md` §3.5.
  - **Faça**: cartão sem borda e sem sombra, raio 20. Grupo de linhas com divisória de 1px em
    `divider` recuada 14px. Linha com `app-icon-tile`, título, subtítulo e um item à direita.
    Estado vazio com título, frase e uma ação.
  - **Feito quando**: a busca por `shadow` e por `border ` nas variantes de `card` não acha classe
    de borda nem de sombra; `npm test -- --watch=false` passa.

- [ ] T022 [P] [US1] Aviso, spinner e esqueleto: `src/app/shared/components/alert/`, `spinner/`, `skeleton/` (`*.variants.ts` ou `*.component.ts` + `*.spec.ts`) e `sections/feedback-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.6 (aviso) e §3.7.
  - **Faça**: aviso com os tipos `neutral`, `success`, `danger` (sem âmbar e sem azul), ícones
    `info`, `checkCircle`, `alert`, e o papel ARIA da tabela.
  - **Feito quando**: os testes conferem as classes e o `role` de cada tipo;
    `npm test -- --watch=false` passa.

- [ ] T023 [US1] Aviso temporário e diálogo: `src/app/shared/components/sonner/`, `alert-dialog/` (`*.variants.ts`) e `sections/overlays-section.ts` (depende de T016)
  - **Referência**: `contracts/shared-components.contract.md` §3.6.
  - **Faça**: aviso temporário em `bg-toast text-toast-foreground`, posição `top-center`, ação em
    lima. Diálogo com fundo `bg-ink/50`, cartão `rounded-2xl bg-popover p-6`, botões em coluna no
    celular e em linha em `md`+. A seção tem um botão que dispara um aviso temporário e um que
    abre um diálogo destrutivo (`data-testid="dev-gallery-open-dialog"`); o `<z-toaster>` fica **na
    seção**, não em `src/app/app.html`.
  - **Feito quando**: `npm run build` e `npm run lint` passam e `src/app/app.html` continua só com
    `<router-outlet />`.

- [ ] T024 [P] [US1] Células de código: `src/app/shared/components/input-otp/` (`*.variants.ts` e, se preciso, o padrão de caracteres) e `sections/code-cells-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §3.7.
  - **Faça**: 6 células de 60px, Outfit 26px/600, as três bordas (vazia, preenchida, ativa). Dois
    exemplos na seção: numérico (código por SMS) e alfanumérico (PIN). Se o componente só aceitar
    dígitos, edite o padrão no arquivo copiado para aceitar `0-9` e `A-Z`. **Não** implemente
    normalização (`O→0`…).
  - **Feito quando**: um teste de unidade prova que o modo alfanumérico aceita `K47Q9M`;
    `npm test -- --watch=false` passa.

- [ ] T025 [P] [US1] Logo e focinho: `src/app/shared/components/faro/logo/brand-assets.ts`, `faro/logo/logo.ts`, `faro/logo/logo.spec.ts`, `faro/focinho/focinho.ts`, `faro/focinho/focinho.spec.ts`
  - **Referência**: `contracts/shared-components.contract.md` §4, §5.1, §5.2.
  - **Faça**: em `brand-assets.ts`, `LOGO` e `FOCINHO`; o `path` é o atributo `d` do único
    `<path>` de `public/logos/logo-compact.svg`, copiado por inteiro. `app-logo` e `app-focinho`
    como no contrato.
  - **Feito quando**: os testes conferem que `app-logo` com `height=48` gera `width="127"` e
    `src` do tom pedido, e que `app-focinho` tem `aria-hidden` sem `label` e `role="img"` com
    `label`; a busca por `/logos/` em `src/` só acha `brand-assets.ts`;
    `npm test -- --watch=false` passa.

- [ ] T026 [US1] Painel de marca, marca circular e "G" do Google: `src/app/shared/components/faro/brand-panel/brand-panel.ts`, `faro/brand-panel/brand-copy.ts`, `faro/brand-mark/brand-mark.ts`, `faro/google-glyph/google-glyph.ts` (+ `.spec.ts`) e `sections/brand-section.ts` (depende de T016 e T025)
  - **Referência**: `contracts/shared-components.contract.md` §5.3, §5.4, §5.5.
  - **Faça**: as medidas do painel por largura estão na tabela do §5.3. Os caminhos do "G" estão
    no §5.4 (copie exatamente). A seção mostra o painel nas variantes `page` e `flow`, a marca
    circular, o botão do WhatsApp (`zType="default"` + `<ng-icon name="whats" />`) e o botão do
    Google (`zType="outline"` + `<app-google-glyph />`).
  - **Feito quando**: os testes conferem que a frase vira uma linha por item de `headline` e que
    o "G" tem as quatro cores `#EA4335`, `#4285F4`, `#FBBC05`, `#34A853`;
    `npm test -- --watch=false` passa.

- [ ] T027 [P] [US1] Cartão de número e passos: `src/app/shared/components/faro/stat-tile/stat-tile.ts`, `faro/steps/steps.ts` (+ `.spec.ts`) e `sections/stats-section.ts`
  - **Referência**: `contracts/shared-components.contract.md` §5.9, §5.10.
  - **Feito quando**: os testes conferem que `app-steps` com `current=2` e `total=3` desenha duas
    barras `bg-foreground` e uma `bg-border`, e o texto "Passo 2 de 3"; que `app-stat-tile` com
    `link` vira um `<a>`; `npm test -- --watch=false` passa.

- [ ] T028 [US1] Capa do pet e cartão de ação: `src/app/shared/components/faro/pet-hero/pet-hero.ts`, `faro/action-card/action-card.ts` (+ `.spec.ts`) e `sections/pet-section.ts` (depende de T016)
  - **Referência**: `contracts/shared-components.contract.md` §5.11, §5.12.
  - **Faça**: na seção, a capa aparece sem foto (`photoUrl` nulo) e o cartão de ação traz um
    `z-button zType="ink" zSize="md"`.
  - **Feito quando**: os testes conferem o estado sem foto (ícone `paw`, texto em
    `text-foreground`) e que o `<h2>` do cartão de ação tem a classe `text-primary-foreground`;
    `npm test -- --watch=false` passa.

- [ ] T029 [US1] Página de componentes da galeria: `src/app/features/dev-gallery/gallery-components/gallery-components.ts` e `dev-gallery.routes.ts` (depende de T016 a T028)
  - **Referência**: `contracts/shells.contract.md` §8.
  - **Faça**: componente `app-gallery-components` com `data-testid="dev-gallery-components"`, um
    `<h1>`, e todas as seções criadas nas tarefas T016 a T028, cada uma sob um `<h2>`. Rota
    `components` em `DEV_GALLERY_ROUTES`. Fundo `bg-background`, sem `.dark`.
  - **Feito quando**: `npm run build` passa e `/dev/ui/components` mostra as 12 seções (confira
    com um teste rápido acrescentado a `e2e/dev-gallery.spec.ts`: existem 12 elementos com
    `data-testid` começando por `gallery-`).

- [ ] T030 [US1] Teste e2e da identidade: `e2e/ui-identity.spec.ts`
  - **Referência**: `spec.md` US1 (cenários 1 a 8); `contracts/design-tokens.contract.md` §4.
  - **Faça**, em `/dev/ui/components`, na largura `phone` e na `desktop`:
    1. o botão `default` tem `background-color` `rgb(132, 195, 46)` e `color` `rgb(19, 32, 30)`;
    2. o chip escolhido e a caixa marcada têm `background-color` `rgb(19, 32, 30)`;
    3. depois de `Tab` até um botão, `outline-color` é `rgb(19, 32, 30)`, `outline-width` é `2px`
       e `outline-style` é `solid`;
    4. todo `button`, `a`, `input` e `[role="switch"]` visível tem caixa (ou área de toque, quando
       estendida por pseudo-elemento, medida pelo rótulo ou contêiner clicável) de pelo menos 44px
       de altura;
    5. `font-family` de um `h1` começa por `Outfit` e a do `body` por `Inter`;
       `await page.evaluate(() => document.fonts.ready)` e depois
       `document.fonts.check('700 40px Outfit')` e `document.fonts.check('400 16px Inter')` são
       verdadeiros;
    6. nenhuma requisição da página vai para `fonts.googleapis.com` ou `fonts.gstatic.com`;
    7. `expectNoSeriousA11y(page)` e `expectNoHorizontalScroll(page)` (este também em `narrow`);
    8. com `page.emulateMedia({ reducedMotion: 'reduce' })`, a `animation-duration` do spinner é
       menor que `0.1s`.
  - **Feito quando**: `npx playwright test e2e/ui-identity.spec.ts` passa.

**Checkpoint**: rode os quatro comandos da regra 5 e `npm run check:ui`. A identidade está pronta
e visível em `/dev/ui/components`.

---

## Phase 4: User Story 2 — Entrar no Faro com a cara nova (P2)

**Goal**: login no desenho aprovado, nas três larguras, com o mesmo comportamento; PrimeNG fora.

**Independent Test**: `npm test -- --watch=false` (o `login.spec.ts` inteiro) e
`npx playwright test e2e/login-ui.spec.ts`.

- [ ] T031 [US2] Migrar o formulário de login: `src/app/features/auth/login/login.ts` e `login.html`; apagar `login.css`
  - **Referência**: `contracts/shared-components.contract.md` §6.1, §6.2, §6.3; tela
    `design/telas-v2/V2-entrar.dc.html` (se a pasta `design/` existir na máquina; o contrato basta).
  - **Faça**: em `login.ts`, tire os oito imports do PrimeNG e os itens correspondentes de
    `imports: []`; tire `providers: [MessageService]` e a injeção; troque as três chamadas
    `messageService.add(...)` pelo serviço do `sonner` com **os mesmos textos** (abra
    `src/app/shared/components/sonner/` para ver a API); acrescente `showPassword = signal(false)`;
    tire `styleUrl`. **Não mude mais nada da lógica.** Reescreva `login.html` com os componentes
    novos, os textos da §6.3, os tons de aviso da §6.2 e **todos** os `data-testid` e `id` da
    tabela da §6.1. Ponha o `<z-toaster>` no topo do template. Nesta tarefa o layout pode ser a
    coluna simples do celular; as larguras vêm na T032.
  - **Feito quando**: `npm run build` e `npm test -- --watch=false` passam (o `login.spec.ts`
    ainda importa `primeng/api`; isso é resolvido na T033); a busca por `primeng` e por `<p-` em
    `login.ts` e `login.html` não acha nada.

- [ ] T032 [US2] Layout do login nas três larguras: `src/app/features/auth/login/login.html`
  - **Referência**: `contracts/shared-components.contract.md` §6.4 (tabela por largura); telas
    `V2-entrar.dc.html`, `V2-entrar-tablet.dc.html`, `V2-entrar-desktop.dc.html`.
  - **Faça**: focinho gigante no celular e no tablet; `app-logo` na coluna; no desktop,
    `app-brand-panel variant="page"` na metade esquerda com a frase e o apoio padrão, e a coluna
    de 400px centralizada na direita. Reserve os 56px do topo no celular (o botão "Voltar" é da
    spec 004). Os dois links com `inline-flex min-h-11 items-center`.
  - **Feito quando**: `npm run build` e `npm test -- --watch=false` passam.

- [ ] T033 [US2] Ajustar o teste do login: `src/app/features/auth/login/login.spec.ts`
  - **Referência**: `contracts/shared-components.contract.md` §6.1 (última parte).
  - **Faça**: **única edição permitida no que já existe**: remover a linha
    `import { MessageService } from 'primeng/api';` e a linha `MessageService,` dos `providers`.
    **Nenhum `expect` existente muda.** No fim do arquivo, acrescente testes novos: (a) não existe
    no DOM nenhum elemento `p-button`, `p-password`, `p-checkbox`, `p-message` nem `p-toast`;
    (b) o `<h1>` contém "te ver de novo"; (c) clicar em `[data-testid="login-password-toggle"]`
    troca o `type` de `[data-testid="login-password"]` de `password` para `text`; (d) o botão do
    Google contém um `<svg>` com o caminho de cor `#4285F4`.
  - **Feito quando**: `npm test -- --watch=false` passa, e `git diff src/app/features/auth/login/login.spec.ts`
    mostra, nas linhas removidas, **só** as duas citadas.

- [ ] T034 [P] [US2] Retorno do Google: `src/app/features/auth/callback/oauth-callback.ts`
  - **Referência**: `contracts/shared-components.contract.md` §6.5.
  - **Faça**: troque o template e apague o bloco `styles: [...]`. Mantenha a lógica, o
    `data-testid="login-callback-container"`, `role="status"`, `aria-live="polite"`, `aria-label`
    e `tabindex="-1"`.
  - **Feito quando**: a busca por `Poppins`, `var(--` e `styles:` em `oauth-callback.ts` não acha
    nada; `npm run build` e `npm run lint` passam.

- [ ] T035 [P] [US2] Tirar o PrimeNG da página inicial: `src/app/features/public/landing/landing.ts`, `landing.html`, e o `title` da rota em `src/app/app.routes.ts`
  - **Faça**: troque `<p-button …>` por `<a z-button routerLink="/auth/login" data-testid="public-landing-cta">Entrar</a>`
    (confira o seletor em `button/index.ts`). Troque o título e o texto por: `<h1>` "O caminho de
    volta para casa." e um parágrafo "A tag com QR Code que ajuda quem achou o seu pet a falar
    com você." Mantenha `data-testid="public-landing"`. Em `app.routes.ts`, o `title` da rota `''`
    vira `'Faro — O caminho de volta para casa'`. O layout definitivo vem na T046.
  - **Feito quando**: `npx playwright test e2e/smoke.spec.ts` passa; a busca por `primeng` em
    `features/public/` não acha nada.

- [ ] T036 [P] [US2] Telas provisórias do app e do admin sem os tokens antigos: `src/app/features/pets/pets/pets.ts`, `pets.html`; apagar `pets.css`
  - **Faça**: reescreva `pets.html` com classes do Tailwind e tokens novos; o botão "Sair" vira
    `<button z-button zType="outline" zSize="sm" …>` e **mantém** `data-testid="login-logout"`,
    `aria-label="Sair da conta"` e o `(click)="signOut()"`. Mantenha `data-testid="pets-home"`.
    Tire o `style="padding: 24px;"` e o `styleUrl`. `admin.html` não usa tokens antigos: não
    mexa.
  - **Feito quando**: a busca por `var(--` e `Poppins` em `features/pets/` não acha nada;
    `npm test -- --watch=false` passa.

- [ ] T037 [US2] Remover o PrimeNG do projeto: `src/app/app.config.ts`, `angular.json`, `package.json`; apagar `src/theme/faro-preset.ts`, `src/styles/faro-ds.css`, `src/styles/faro-shells.css`, `src/styles/README.md` (depende de T031 a T036)
  - **Faça**:
    1. `app.config.ts`: tire o import de `providePrimeNG`, o import de `FaroPreset`, o bloco
       `providePrimeNG({...})` e o comentário dele. **Não** tire o `provideServiceWorker` ainda
       (é da T057).
    2. `angular.json`: `"styles": ["src/styles.css"]`.
    3. Apague os quatro arquivos listados (as pastas `src/theme/` e `src/styles/` somem).
    4. `npm rm primeng @primeuix/themes primeicons`
  - **Feito quando**: os quatro comandos da regra 5 passam; a busca por `primeng`, `primeuix` e
    `primeicons` em `src/`, `angular.json` e `package.json` não acha nada.

- [ ] T038 [US2] Checagem "não sobrou a pilha antiga": `scripts/ui-checks/removed-stack.mjs` e os scripts `check:stack` e `check:ui` em `package.json`
  - **Referência**: `contracts/design-tokens.contract.md` §1 e §6; `research.md` §R16.
  - **Faça**: script de Node sem dependências que percorre `src/` (arquivos `.ts`, `.html`,
    `.css`) e lê `package.json` e `angular.json`, e falha (código 1, listando arquivo e linha) se:
    1. `dependencies` ou `devDependencies` contêm `primeng`, `primeicons`, `@primeuix/…`,
       `@primeng/…` ou `@ng-icons/lucide`;
    2. algum arquivo de `src/` casa com
       `primeng|@primeuix|primeicons|providePrimeNG|FaroPreset|\bpi pi-|<p-[a-z]|\bpButton\b|\bpInputText\b`;
    3. `angular.json` → `styles` é diferente de `["src/styles.css"]`;
    4. existe `src/styles/`, `src/theme/`, `src/app/features/health-records/`,
       `src/app/features/reminders/` ou `src/app/features/subscription/`;
    5. algum arquivo de `src/` casa (sem diferenciar maiúsculas) com
       `Poppins|JetBrains|#3A4FD6|#7FBF3F|faro-dark|--surface-0|--text-strong|var\(--app\b|var\(--r-(sm|md|lg)\)|var\(--indigo-|fonts\.googleapis|fonts\.gstatic`;
    6. algum arquivo de `src/` **que não seja `src/styles.css`** declara variável de tema
       (`--(background|foreground|card|primary|secondary|muted|accent|destructive|border|input|ring|brand|ink|lost|text|link)\s*:`);
    7. algum arquivo de `src/app/` (fora `*.spec.ts` e
       `shared/components/faro/google-glyph/google-glyph.ts`) contém cor solta:
       `#[0-9a-fA-F]{6}\b` ou `\b(rgb|rgba|hsl|hsla|oklch)\(`.
    Se a regra 7 apontar código copiado do ZardUI, troque a cor por um token; se não houver token
    equivalente, PARE e reporte.
    Em `package.json`: `"check:stack": "node scripts/ui-checks/removed-stack.mjs"` e
    `"check:ui": "npm run check:tokens && npm run check:stack"`.
  - **Feito quando**: `npm run check:ui` sai com código 0.

- [ ] T039 [US2] Teste e2e do login: `e2e/login-ui.spec.ts`
  - **Referência**: `spec.md` US2; `contracts/shared-components.contract.md` §6.
  - **Faça**, em `/auth/login`:
    1. nas larguras `narrow`, `phone`, `tablet` e `desktop`: estão visíveis `login-email`,
       `login-password`, `login-password-toggle`, `login-remember`, `login-submit`,
       `login-google`, `login-forgot-link`, `login-signup-link`; `expectNoHorizontalScroll`;
       `expectNoSeriousA11y`;
    2. `phone` e `tablet`: o wordmark (`img[alt="Faro"]`) está visível na coluna e não há painel de
       marca visível;
    3. `desktop`: o painel de marca está visível, ocupa a metade esquerda (largura entre 700 e
       740px) e contém o texto "para casa."; há exatamente um `img[alt="Faro"]` visível;
    4. `login-submit` tem `background-color` `rgb(132, 195, 46)`; `login-google` tem
       `background-color` `rgb(255, 255, 255)`;
    5. `login-submit`, `login-google`, `login-password-toggle`, `login-email`, `login-password`,
       `login-forgot-link`, `login-signup-link` têm altura de pelo menos 44px, e o rótulo de
       `login-remember` também;
    6. depois de `Tab` até `login-email`, o `outline-color` é `rgb(19, 32, 30)`;
    7. com `test.use({ colorScheme: 'dark' })` e `localStorage` `faro.theme = 'dark'` (via
       `page.addInitScript`), o `background-color` do `body` continua `rgb(247, 248, 248)` e não
       existe elemento com a classe `dark`;
    8. enviar o formulário vazio mostra `login-email-error` e `login-password-error`;
    9. nenhuma requisição vai para `fonts.googleapis.com` nem `fonts.gstatic.com`.
  - **Feito quando**: `npx playwright test e2e/login-ui.spec.ts` passa.

**Checkpoint**: rode os quatro comandos da regra 5 e `npm run check:ui`. Login migrado; nenhum
vestígio de PrimeNG.

---

## Phase 5: User Story 3 — Celular, tablet e computador (P2)

**Goal**: as quatro cascas, ligadas às rotas, com a fronteira da página pública provada.

**Independent Test**: `npx playwright test e2e/ui-shells.spec.ts`, `npm run check:boundary`,
`npm run build:stats` e `npm run check:bundle`.

- [ ] T040 [US3] Peças comuns das cascas: `src/app/shared/shells/nav-item.ts`, `src/app/shared/shells/leaf-route-data.ts` (+ `.spec.ts`), `src/app/shared/shells/screen-header/screen-header.ts` (+ `.spec.ts`)
  - **Referência**: `contracts/shells.contract.md` §1, §2.3, §2.4.
  - **Faça**: `NavItem`; `leafRouteData<T>(key)` (um `Signal` com `data[key]` da rota-folha
    ativa, atualizado a cada `NavigationEnd`; use `toSignal`); `app-screen-header` com `title`,
    `back`, `backLink`, `backClick` e a projeção `[action]`.
  - **Feito quando**: os testes conferem que `leafRouteData('hub')` devolve `true` numa rota com
    `data: { hub: true }` e `undefined` em outra, e que o cabeçalho mostra o botão com
    `aria-label="Voltar"` ou `"Fechar"` conforme `back`; `npm test -- --watch=false` passa.

- [ ] T041 [US3] Casca do app do tutor: `src/app/shared/shells/tutor-shell/tutor-shell.ts`, `tutor-shell.html`, `tutor-nav.ts`, `tutor-shell.spec.ts` (depende de T040)
  - **Referência**: `contracts/shells.contract.md` §2.1, §2.2 (tabela por largura).
  - **Faça**: as três navegações no DOM, com as classes de visibilidade por largura; item ativo
    com `aria-current="page"` e `bg-foreground text-background`; barra inferior só com
    `bottomNav`; identificação do tutor no pé do menu lateral; atalho "Pular para o conteúdo" com
    manipulador de clique; `<main id="conteudo" tabindex="-1">`. **Não** aplique o tema escuro
    ainda (é da T052). A casca **não** importa `core/auth`.
  - **Feito quando**: os testes conferem: três `<nav aria-label="Navegação principal">`; com
    `bottomNav=false` não existe `tutor-shell-bottom-nav`; com `true`, existe; a inicial do nome
    aparece em `tutor-shell-user`; `npm test -- --watch=false` passa.

- [ ] T042 [P] [US3] Casca dos fluxos: `src/app/shared/shells/flow-shell/flow-shell.ts`, `flow-shell.html`, `flow-shell.spec.ts` (depende de T040)
  - **Referência**: `contracts/shells.contract.md` §3.
  - **Feito quando**: os testes conferem a projeção do corpo e de `[footer]`, que `step` mostra
    `app-steps`, e que o painel de marca tem `data-testid="flow-shell-brand-panel"`;
    `npm test -- --watch=false` passa.

- [ ] T043 [P] [US3] Casca do admin: `src/app/shared/shells/admin-shell/admin-shell.ts`, `admin-shell.html`, `admin-nav.ts`, `admin-shell.spec.ts` (depende de T040)
  - **Referência**: `contracts/shells.contract.md` §4.
  - **Feito quando**: os testes conferem as duas navegações (`admin-shell-topbar`,
    `admin-shell-sidebar`), o selo "Admin" e os quatro `admin-nav-<id>`;
    `npm test -- --watch=false` passa.

- [ ] T044 [P] [US3] Páginas públicas: `src/app/shared/shells/public-layout/public-layout.ts`, `public-footer.ts`, `public-layout.spec.ts`
  - **Referência**: `contracts/shells.contract.md` §5.
  - **Faça**: nenhum import de `core/`, nenhum overlay, nenhum uso de `window`/`document`.
  - **Feito quando**: os testes conferem as três projeções, as alturas da faixa por `media` e que
    o rodapé mostra "Tag " + código só quando `code` é informado; `npm test -- --watch=false`
    passa.

- [ ] T045 [US3] Ligar as cascas às rotas: `src/app/shared/shells/shell-fallback/shell-fallback.ts`, `src/app/features/pets/tutor-app/tutor-app.ts`, `src/app/features/admin/admin-app/admin-app.ts`, `src/app/app.routes.ts`, `src/app/app.routes.server.ts`, `src/app/features/pets/pets/pets.html`, `src/app/features/admin/admin/admin.html` (depende de T041 e T043)
  - **Referência**: `contracts/shells.contract.md` §7.
  - **Faça**: crie `ShellFallback`, `TutorApp` e `AdminApp` como no contrato (o `<z-toaster>` fica
    nos dois hospedeiros). Em `app.routes.ts`, `app` e `admin` passam a ter `loadComponent` do
    hospedeiro e `children` (a tela provisória em `''` e o `**` para `ShellFallback`); os
    `canMatch` continuam no pai. Em `app.routes.server.ts`, acrescente as linhas `app/**` e
    `admin/**` como `RenderMode.Client`. Em `pets.html` e `admin.html`, troque `<main>` por
    `<section>` e tire o cabeçalho próprio de `pets.html` (o botão "Sair" com
    `data-testid="login-logout"` continua na tela).
  - **Feito quando**: os quatro comandos da regra 5 passam (em especial `guards.spec.ts`,
    `pets.spec.ts` e `admin.spec.ts`).

- [ ] T046 [US3] Página inicial com a estrutura pública: `src/app/features/public/landing/landing.ts`, `landing.html` (depende de T044)
  - **Referência**: `contracts/shells.contract.md` §5 e §7.
  - **Faça**: `<app-public-layout media="band">` com `<app-brand-panel>` em `[media]` (frase e
    apoio padrão no desktop), o `<h1>` e o parágrafo da T035 no conteúdo, o botão "Entrar"
    (`zSize="lg"`) e `<app-public-footer trust="Faro é a tag de identificação do seu pet.">`.
    Mantenha `data-testid="public-landing"` e `data-testid="public-landing-cta"`.
  - **Feito quando**: `npx playwright test e2e/smoke.spec.ts` e `npm run build` passam (a página
    é pré-renderizada: o build falha se algo usar `window` no servidor).

- [ ] T047 [US3] Fronteira da página pública no lint: `eslint.config.js`, `scripts/ui-checks/boundary.mjs`, scripts `check:boundary` e `check:ui` em `package.json`
  - **Referência**: `contracts/shells.contract.md` §9.
  - **Faça**: troque o `group` e a `message` da regra `no-restricted-imports` do bloco
    `src/app/features/public/**/*.ts` pelos do contrato. Crie `boundary.mjs`: usa
    `new ESLint()` e `lintText(codigo, { filePath: 'src/app/features/public/__probe__.ts' })`;
    para **cada** padrão proibido do contrato, monta um `import` que casa com ele (nas formas
    relativa, por exemplo `../../pets/x`, e com alias, `@/features/pets/x`) e exige uma mensagem
    com `ruleId` `no-restricted-imports`; para os imports permitidos
    (`@/shared/shells/public-layout/public-layout`, `@/shared/components/faro/logo/logo`,
    `@/shared/components/button`, `@/shared/icons/faro-icons`), exige **nenhuma** mensagem dessa
    regra. Sai com código 1 se algo divergir. Em `package.json`:
    `"check:boundary": "node scripts/ui-checks/boundary.mjs"` e
    `"check:ui": "npm run check:tokens && npm run check:stack && npm run check:boundary"`.
  - **Feito quando**: `npm run check:ui` e `npm run lint` passam.

- [ ] T048 [US3] Páginas das cascas na galeria: `src/app/features/dev-gallery/gallery-tutor/`, `gallery-flow/`, `gallery-admin/`, `gallery-public/` e `dev-gallery.routes.ts` (depende de T041 a T044)
  - **Referência**: `contracts/shells.contract.md` §8 (tabela de rotas e `data-testid`).
  - **Faça**: as páginas `tutor` (com `bottomNav`), `tutor/inner` (com `app-screen-header`),
    `flow`, `admin`, `public` e `public/photo`. Os itens de navegação apontam para páginas da
    própria galeria. A página `tutor` reúne capa do pet, cartão lima, cartões de número, grupo de
    linhas com interruptor, chips, selos, campos e o botão que abre o diálogo. Dados de exemplo:
    Ana, `ana@email.com`, Paçoca, `7K3M-Q9XA-C`.
  - **Feito quando**: `npm run build` e `npm run lint` passam e `e2e/dev-gallery.spec.ts`, com um
    teste novo que visita as seis rotas e espera o `data-testid` de cada uma, passa.

- [ ] T049 [US3] Teste e2e das cascas: `e2e/ui-shells.spec.ts`
  - **Referência**: `spec.md` US3 (cenários 1 a 10).
  - **Faça**:
    1. `/dev/ui/tutor`: em `phone`, `tutor-shell-bottom-nav` visível, `tutor-shell-rail` e
       `tutor-shell-sidebar` ocultos; em `tablet`, só o trilho; em `desktop`, só o menu lateral,
       com `tutor-shell-user` visível;
    2. `/dev/ui/tutor/inner` em `phone`: **não** há barra inferior; há um botão com
       `aria-label="Voltar"`;
    3. o item atual tem `aria-current="page"` e `background-color` `rgb(19, 32, 30)`;
    4. `/dev/ui/flow`: em `phone`, `flow-shell-footer` está na metade de baixo da tela; em
       `tablet`, a coluna tem 480px (±2); em `desktop`, `flow-shell-brand-panel` visível com 560px
       (±2);
    5. `/dev/ui/admin`: `admin-shell-topbar` visível em `phone` e `tablet`;
       `admin-shell-sidebar` só em `desktop`;
    6. `/dev/ui/public`: em `phone`, `public-layout-media` fica acima de `public-layout-sheet`; em
       `desktop`, ficam lado a lado e `public-footer` está visível;
    7. em todas as páginas e nas quatro larguras: `expectNoHorizontalScroll`; nas larguras `phone`
       e `desktop`: `expectNoSeriousA11y`;
    8. o primeiro `Tab` em `/dev/ui/tutor` foca o atalho "Pular para o conteúdo", e `Enter` leva o
       foco para `#conteudo`.
  - **Feito quando**: `npx playwright test e2e/ui-shells.spec.ts` passa.

- [ ] T050 [US3] Fronteira no pacote: `scripts/ui-checks/public-bundle.mjs` e os scripts `build:stats` e `check:bundle` em `package.json`
  - **Referência**: `contracts/shells.contract.md` §10; `research.md` §R15.
  - **Faça**: em `package.json`: `"build:stats": "ng build --stats-json"` e
    `"check:bundle": "node scripts/ui-checks/public-bundle.mjs"`. O script lê
    `dist/faro/stats.json` (formato do esbuild: `outputs[arquivo] = { imports: [{ path, kind }], inputs: { caminho: … }, entryPoint? }`),
    considera só saídas `.js`, e:
    1. monta o conjunto de partida: as saídas cujo nome começa por `main-` ou `polyfills-` e as
       que têm `entryPoint` começando por `src/app/features/public/`;
    2. segue os `imports` com `kind === 'import-statement'` até fechar o conjunto;
    3. junta as chaves de `inputs` de todas as saídas do conjunto e **falha** se alguma casar com
       os padrões proibidos do contrato §10 item 1;
    4. **avisa sem falhar** quando achar `src/app/core/auth/` ou `src/app/core/supabase/`
       (exceção conhecida);
    5. falha se alguma saída tiver fonte de `src/app/features/dev-gallery/`;
    6. falha se `dist/faro/browser/index.csr.html` ou algum `.html` de `dist/faro/browser/`
       contiver `onload=`;
    7. falha se algum `.css` de `dist/faro/browser/` contiver `0FA12E`;
    8. com o argumento `--self-test`, roda a mesma lógica sobre um mapa de exemplo embutido no
       script, que tem uma violação, e exige que ela seja detectada (sai com 0 se detectou).
    Se `dist/faro/stats.json` não tiver `outputs` ou `entryPoint`, PARE e reporte.
  - **Feito quando**: `node scripts/ui-checks/public-bundle.mjs --self-test` sai com 0;
    `npm run build:stats` e depois `npm run check:bundle` saem com 0.

**Checkpoint**: rode os quatro comandos da regra 5, `npm run check:ui`, `npm run build:stats` e
`npm run check:bundle`. As cascas existem, as rotas usam as cascas e a página pública está isolada.

---

## Phase 6: User Story 4 — Tema escuro no app do tutor (P3)

**Goal**: preferência claro/escuro/sistema por aparelho; `.dark` só na casca do tutor.

**Independent Test**: `npx playwright test e2e/ui-theme.spec.ts`.

- [ ] T051 [US4] Serviço de tema: `src/app/core/theme/theme.service.ts`, `theme.service.spec.ts`
  - **Referência**: `contracts/shells.contract.md` §6.2.
  - **Faça**: a API do contrato. `localStorage` e `matchMedia` só no navegador
    (`isPlatformBrowser`), dentro de `try/catch`. O serviço não toca no DOM.
  - **Feito quando**: os testes conferem: padrão `system`; valor inválido guardado vira `system`;
    `setPreference('dark')` grava `faro.theme = 'dark'` e `resolved()` vira `dark`; com `system`,
    `resolved()` segue um `matchMedia` simulado, inclusive quando ele muda; se `localStorage`
    lançar erro, nada quebra; `npm test -- --watch=false` passa.

- [ ] T052 [US4] A casca do tutor aplica o tema: `src/app/shared/shells/tutor-shell/tutor-shell.ts`, `tutor-shell.html`, `tutor-shell.spec.ts` (depende de T051)
  - **Referência**: `contracts/shells.contract.md` §6.3 (itens 1, 2 e 4) e §2.2 (logo do menu).
  - **Faça**: `[class.dark]="theme.resolved() === 'dark'"` no hospedeiro; o contêiner interno
    pinta `bg-background`; o `app-logo` do menu lateral usa `tone="on-dark"` no escuro. Nenhuma
    outra casca injeta `ThemeService`.
  - **Feito quando**: os testes conferem que o hospedeiro ganha e perde a classe `dark` conforme
    o serviço e que `document.documentElement` e `document.body` **nunca** recebem a classe;
    `npm test -- --watch=false` passa.

- [ ] T053 [US4] Diálogos acompanham o tema: `src/app/shared/shells/tutor-shell/tutor-shell.ts`, `tutor-shell.spec.ts` (depende de T052)
  - **Referência**: `contracts/shells.contract.md` §6.3 (item 3); item 6 da seção `## Spike` do
    `execution-log.md` (onde o diálogo é anexado).
  - **Faça**: enquanto a casca está montada, replique a classe `dark` no contêiner de overlays
    registrado no spike (o esperado é o elemento devolvido por `OverlayContainer.getContainerElement()`,
    de `@angular/cdk/overlay`), por um `effect`, só no navegador. Ao destruir a casca
    (`DestroyRef.onDestroy`), **remova** a classe.
  - **Feito quando**: os testes conferem que o contêiner ganha `dark` com o tema escuro, perde ao
    voltar para claro e perde ao destruir a casca; `npm test -- --watch=false` passa.

- [ ] T054 [P] [US4] Botões de tema na galeria: `src/app/features/dev-gallery/gallery-tutor/`
  - **Faça**: no topo da página `/dev/ui/tutor`, um segmentado "Claro / Escuro / Sistema"
    (`data-testid="dev-gallery-theme-switch"`) que chama `ThemeService.setPreference`. Só nessa
    página.
  - **Feito quando**: `npm run build` e `npm run lint` passam.

- [ ] T055 [US4] Teste e2e do tema: `e2e/ui-theme.spec.ts` (depende de T052 a T054)
  - **Referência**: `spec.md` US4 (cenários 1 a 8).
  - **Faça**:
    1. com `localStorage` `faro.theme = 'dark'` (`page.addInitScript`), `/dev/ui/tutor`: o
       hospedeiro `app-tutor-shell` tem a classe `dark`; o `background-color` do contêiner interno
       é `rgb(11, 15, 42)`; `html` e `body` **não** têm a classe; o `background-color` do `body`
       é `rgb(247, 248, 248)`;
    2. sem `localStorage` e com `colorScheme: 'dark'`: escuro; com `colorScheme: 'light'`: claro;
    3. com `faro.theme = 'light'` e `colorScheme: 'dark'`: claro;
    4. preferência `system`: `page.emulateMedia({ colorScheme: 'dark' })` com a página aberta
       escurece sem recarregar;
    5. escolher "Escuro" no `dev-gallery-theme-switch`, recarregar: continua escuro;
    6. com `faro.theme = 'dark'` **e** `colorScheme: 'dark'`, em `/`, `/auth/login`,
       `/dev/ui/flow`, `/dev/ui/admin`, `/dev/ui/public` e `/dev/ui/components`:
       `document.querySelectorAll('.dark').length === 0`;
    7. no escuro, clicar em `dev-gallery-open-dialog`: o `background-color` do cartão do diálogo é
       `rgb(22, 28, 74)`; fechar; navegar para `/dev/ui/flow`: não existe `.dark` no documento;
    8. no escuro, o item ativo da navegação tem `background-color` `rgb(243, 245, 252)` e o botão
       principal continua `rgb(132, 195, 46)`;
    9. `expectNoSeriousA11y(page)` em `/dev/ui/tutor` no escuro, em `phone` e `desktop`.
  - **Feito quando**: `npx playwright test e2e/ui-theme.spec.ts` passa.

- [ ] T056 [US4] Checagem "`.dark` só na casca do tutor": `scripts/ui-checks/removed-stack.mjs`
  - **Faça**: acrescente duas regras ao script: (8) em `src/app/` (fora `*.spec.ts` e
    `src/app/features/dev-gallery/`), só os arquivos de `src/app/shared/shells/tutor-shell/`
    podem conter `class.dark`, `classList.add('dark')`, `classList.toggle('dark'` ou
    `class="dark`; (9) nenhum arquivo de `src/` contém `documentElement.classList` nem
    `body.classList` junto com `dark` na mesma linha. (A variante `dark:` em classes do Tailwind
    é permitida em qualquer componente.)
  - **Feito quando**: `npm run check:ui` sai com código 0.

**Checkpoint**: rode os quatro comandos da regra 5 e `npm run check:ui`.

---

## Phase 7: User Story 5 — Versão sempre atual e o focinho como ícone (P3)

**Goal**: sem service worker; workers antigos se desligam; ícones novos.

**Independent Test**: `npx playwright test e2e/legacy-sw.spec.ts` e conferir os arquivos de
`public/icons/`.

- [ ] T057 [US5] Remover o service worker e deixar o arquivo de desligamento: `public/ngsw-worker.js`, `src/app/app.config.ts`, `angular.json`, `package.json`; apagar `ngsw-config.json`
  - **Referência**: `research.md` §R12. **A ordem importa.**
  - **Faça**:
    1. **Primeiro**, copie o arquivo de desligamento (antes de desinstalar o pacote):
       `node -e "require('fs').copyFileSync('node_modules/@angular/service-worker/safety-worker.js','public/ngsw-worker.js')"`
       e acrescente no topo do arquivo copiado um comentário de três linhas: o que ele faz, por
       que existe ("navegadores que registraram o service worker antigo o largam ao receber este
       script") e "manter por pelo menos 12 meses após o deploy; ver specs/002-ui-zardui/research.md §R12".
    2. `app.config.ts`: tire `provideServiceWorker(...)`, o import de `@angular/service-worker` e
       o `isDevMode` se ficar sem uso.
    3. `angular.json`: tire `"serviceWorker": "ngsw-config.json"` da configuração de produção.
    4. Apague `ngsw-config.json`.
    5. `npm rm @angular/service-worker`
  - **Feito quando**: `npm run build`, `npm run lint` e `npm test -- --watch=false` passam, e este
    comando imprime `ok`:
    `node -e "const fs=require('fs');const d='dist/faro/browser/';if(!fs.readFileSync(d+'ngsw-worker.js','utf8').includes('registration.unregister'))throw new Error('arquivo de desligamento ausente');if(fs.existsSync(d+'ngsw.json'))throw new Error('ngsw.json ainda existe');console.log('ok')"`

- [ ] T058 [US5] Limpeza de service workers no carregamento: `src/app/core/pwa/unregister-service-workers.ts`, `unregister-service-workers.spec.ts`, `src/main.ts`
  - **Referência**: `research.md` §R12 (camada 2).
  - **Faça**: função `unregisterServiceWorkers(): Promise<void>` que, se existir
    `navigator.serviceWorker`, cancela todos os registros (`getRegistrations()` + `unregister()`)
    e, se existir `caches`, apaga os caches cujo nome começa por `ngsw:`. Tudo dentro de
    `try/catch`; nunca lança. Em `src/main.ts`, chame `void unregisterServiceWorkers();` antes do
    `bootstrapApplication`. Não chame em `main.server.ts`.
  - **Feito quando**: os testes conferem, com `navigator.serviceWorker` e `caches` simulados: os
    registros são cancelados; só os caches `ngsw:*` são apagados; uma rejeição não vira exceção;
    sem `serviceWorker` no `navigator`, a função termina sem erro; `npm test -- --watch=false`
    passa.

- [ ] T059 [US5] Teste e2e do worker antigo: `e2e/legacy-sw.spec.ts` (depende de T057)
  - **Faça**: abre `/`; dentro de `page.evaluate`, registra `'/ngsw-worker.js'` com
    `navigator.serviceWorker.register` e consulta `getRegistrations()` a cada 250ms por até 10s;
    o teste exige que a lista fique vazia. Um segundo teste confere que a resposta de
    `/ngsw-worker.js` tem `content-type` de JavaScript e contém `registration.unregister`. Um
    terceiro confere que, depois de carregar `/`, `getRegistrations()` está vazia.
  - **Feito quando**: `npx playwright test e2e/legacy-sw.spec.ts` passa.

- [ ] T060 [US5] Gerar os ícones do app: `scripts/generate-icons.mjs`, `public/favicon.svg`, `public/favicon.ico`, `public/icons/`; apagar os seis PNGs antigos
  - **Referência**: `research.md` §R13.
  - **Faça**: script de Node que usa `chromium` de `@playwright/test`:
    1. lê o atributo `d` do `<path>` de `public/logos/logo-compact.svg` (o `viewBox` do desenho
       recortado é `20 20 234 207`);
    2. para cada saída, abre uma página do tamanho pedido com fundo `#25337A` e o focinho em
       `#84C32E` centralizado, e tira um `screenshot`:
       `icons/icon-192x192.png` e `icons/icon-512x512.png` (focinho com 72% da largura),
       `icons/icon-maskable-192x192.png` e `icons/icon-maskable-512x512.png` (52%),
       `icons/apple-touch-icon.png` (180px, 68%), `icons/favicon-32x32.png` (32px, 78%) e uma
       imagem de 48px (78%) só para o `.ico`;
    3. escreve `public/favicon.svg`: `viewBox="0 0 64 64"`, um `<rect>` de 64px com `rx="14"` em
       `#25337A` e o focinho em `#84C32E` com 72% da largura, centralizado;
    4. escreve `public/favicon.ico` com as imagens de 32 e 48px: cabeçalho de 6 bytes
       (`00 00`, `01 00`, quantidade em 2 bytes); para cada imagem, 16 bytes (largura, altura,
       `00`, `00`, planos `01 00`, bits `20 00`, tamanho do PNG em 4 bytes, deslocamento em 4
       bytes; tudo *little-endian*); depois os PNGs inteiros;
    5. lê de volta a largura e a altura de cada PNG (bytes 16 a 23 do arquivo) e falha se não
       baterem.
    Rode `node scripts/generate-icons.mjs`. Depois apague `public/icons/icon-72x72.png`,
    `icon-96x96.png`, `icon-128x128.png`, `icon-144x144.png`, `icon-152x152.png`,
    `icon-384x384.png`. As cores em hexadecimal são permitidas em `scripts/`.
  - **Feito quando**: o script termina com código 0; `public/icons/` contém exatamente
    `apple-touch-icon.png`, `favicon-32x32.png`, `icon-192x192.png`, `icon-512x512.png`,
    `icon-maskable-192x192.png`, `icon-maskable-512x512.png`; existem `public/favicon.svg` e
    `public/favicon.ico` (este com mais de 500 bytes e começando pelos bytes `00 00 01 00`).

- [ ] T061 [US5] Manifest e cabeçalho da página: `public/manifest.webmanifest`, `src/index.html`
  - **Referência**: `research.md` §R13.
  - **Faça**: manifest com `"name": "Faro"`, `"short_name": "Faro"`,
    `"description": "O caminho de volta para casa."`, `"lang": "pt-BR"`, `"start_url": "/"`,
    `"scope": "/"`, `"display": "standalone"`, `"theme_color": "#25337A"`,
    `"background_color": "#F7F8F8"` e quatro ícones: 192 e 512 com `"purpose": "any"`, os dois
    `maskable` com `"purpose": "maskable"`. Em `index.html`: `theme-color` vira `#25337A`; troque
    a linha do `favicon.ico` por
    `<link rel="icon" href="favicon.ico" sizes="48x48" />`,
    `<link rel="icon" type="image/svg+xml" href="favicon.svg" />`,
    `<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32x32.png" />` e
    `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />`. Mantenha o
    `<link rel="manifest">`.
  - **Feito quando**: `node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest','utf8'));console.log('ok')"`
    imprime `ok`; `src/index.html` não contém `3A4FD6`; `npm run build` passa.

- [ ] T062 [US5] Checagem "não sobrou service worker": `scripts/ui-checks/removed-stack.mjs`
  - **Faça**: acrescente as regras: (10) `package.json` não contém `@angular/service-worker`;
    (11) `ngsw-config.json` não existe; (12) `angular.json` não contém `serviceWorker`;
    (13) nenhum arquivo de `src/` contém `provideServiceWorker`, `@angular/service-worker` nem
    `serviceWorker.register`; (14) **exceção exigida**: `public/ngsw-worker.js` existe e contém
    `registration.unregister`; (15) `public/manifest.webmanifest` não aponta para arquivo de
    ícone que não existe em `public/`.
  - **Feito quando**: `npm run check:ui` sai com código 0.

**Checkpoint**: rode os quatro comandos da regra 5 e `npm run check:ui`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T063 Marcar os textos fixos para tradução e ligar a regra de lint: `eslint.config.js`, templates de `src/app/shared/components/faro/**`, `src/app/shared/shells/**`, `src/app/features/auth/**`, `features/public/landing/`, `features/pets/**`, `features/admin/**`
  - **Referência**: `contracts/shared-components.contract.md` §1 (regra 4).
  - **Faça**: ponha `i18n` nos elementos com texto fixo e `i18n-aria-label` (ou `i18n-title`,
    `i18n-placeholder`) nos atributos com texto; em TypeScript, `$localize`. No bloco `**/*.html`
    do `eslint.config.js`, ligue `'@angular-eslint/template/i18n': ['error', { checkId: false, checkText: true, checkAttributes: true }]`
    e acrescente um bloco que a **desliga** para `src/app/shared/components/**` (exceto `faro/`),
    `src/app/shared/core/**`, `src/app/features/dev-gallery/**` e
    `src/app/features/public/rescue-page/**` (a spec 003 refaz essa tela). Se a regra gerar falso
    positivo que você não resolve em 30 minutos com `ignoreAttributes`/`ignoreTags`, deixe-a como
    `'warn'`, anote no log e siga (isto **não** é motivo de parada).
  - **Feito quando**: `npm run lint`, `npm run build` e `npm test -- --watch=false` passam.

- [ ] T064 [P] Varredura final de restos em `src/`
  - **Faça**: procure e elimine em `src/`: comentários que citam PrimeNG, Aura, `FaroPreset`,
    Paleta C, `faro-ds.css`, PWA ou service worker como se existissem (em especial em
    `src/app/app.config.ts`, `src/app/app.routes.ts`, `src/app/app.routes.server.ts`,
    `src/app/features/auth/login/login.ts`); referências a `docs/frontend.md` e
    `docs/architecture.md` em comentários; emoji em texto de interface.
  - **Feito quando**: a busca (sem diferenciar maiúsculas) por `primeng|aura|faropreset|paleta c|faro-ds`
    em `src/` não acha nada; `npm run check:ui` passa.

- [ ] T065 [P] Validar o `specs/002-ui-zardui/quickstart.md`
  - **Faça**: siga as seções 2 e 3 do quickstart do começo ao fim (pelo Playwright, não por
    `npm start`: os endereços da seção 2 são cobertos por `e2e/dev-gallery.spec.ts`). Se algum
    comando ou caminho do quickstart não corresponder ao que foi implementado, **não edite o
    quickstart**: anote a diferença em `## Desvios e decisões` do log.
  - **Feito quando**: todos os comandos da seção 3 do quickstart passam e as diferenças, se
    houver, estão no log.

- [ ] T066 [P] Atualizar o comentário da CSP: `src/server.ts`
  - **Referência**: `research.md` §R19. **Não mude a política, só o comentário.**
  - **Faça**: no bloco de comentário do topo, troque a justificativa de `style-src` por:
    "`'unsafe-inline'` continua necessário porque o Angular e o aviso temporário injetam
    elementos `<style>`; endurecer com nonce é melhoria futura". Troque "fontes Poppins/Inter" por
    "fontes Outfit e Inter, servidas de /fonts". A constante `CSP` e o `vercel.json` ficam
    idênticos.
  - **Feito quando**: `git diff src/server.ts` mostra mudança só em linhas de comentário;
    `git diff vercel.json` está vazio; `npm run build` passa.

- [ ] T067 [P] Atualizar a orientação de runtime: `CLAUDE.md` e a memória do agente em `.claude/agent-memory/frontend-angular/`
  - **Faça**, em `CLAUDE.md` (edições pontuais, sem reescrever):
    1. "Estado atual do código": o código não importa mais PrimeNG; a migração `002` foi feita;
    2. em "Commands": `npx zard-cli@1.12.0 add <componente> --yes` (com o número da versão) e as
       linhas `npm run check:ui`, `npm run build:stats`, `npm run check:bundle`;
    3. em "Project Structure": `core/theme`, `shared/components/faro/`, `shared/shells/`,
       `shared/core` e `shared/utils` (do ZardUI), `features/dev-gallery` (só em dev) e
       `scripts/ui-checks/`;
    4. em "Recent Changes": uma linha com a data e o resumo desta feature.
    Na memória do agente (só se os arquivos ainda existirem): apague
    `feedback-prefer-native-primeng.md` e `gotcha-css-layer-primeng-vs-faro-ds.md`; reescreva
    `project-structure.md` e `reference-logo-variants.md` para a estrutura nova (a troca de logo
    por tema é feita por `tone`, não por `.faro-dark`); em `build-pitfalls.md`, tire a parte do
    orçamento de CSS de componente; crie `zardui-pitfalls.md` com as armadilhas novas de
    `research.md` §R17; atualize o índice `MEMORY.md`.
  - **Feito quando**: a busca por `PrimeNG` em `.claude/agent-memory/frontend-angular/` só acha
    menções históricas ("saiu na 002"); `CLAUDE.md` cita `zard-cli@1.12.0`.

- [ ] T068 [P] Medir os critérios de sucesso que são números: `specs/002-ui-zardui/execution-log.md`
  - **Referência**: `spec.md` SC-012.
  - **Faça**: depois de `npm run build`, repita a medição da T001 (passo 4) e escreva em
    `## Resultado final` uma tabela "antes × depois": soma dos `.js` e dos `.css` de
    `dist/faro/browser/`, e o tamanho de `index.html`. Some também só os arquivos que a página
    inicial carrega (os `<script src>` e `<link rel="modulepreload">` de
    `dist/faro/browser/index.html` mais o `.css`). Se o "depois" da página inicial for maior que
    o "antes", **não tente otimizar**: escreva o número e o motivo provável.
  - **Feito quando**: a tabela está no log.

- [ ] T069 Verificação final
  - **Faça**: rode a seção "Verificação final" deste arquivo, na ordem. Escreva o resultado de
    cada comando em `## Resultado final` do log, e liste as tarefas que ficaram por fazer, os
    desvios e as paradas.
  - **Feito quando**: todos os comandos passam e o log está completo.

- [ ] T070 **BLOQUEADA (depende do William)**: trocar os arquivos do logo quando o novo wordmark em Outfit chegar — `public/logos/logo-full-light.svg`, `public/logos/logo-full-dark.svg` e, se preciso, `src/app/shared/components/faro/logo/brand-assets.ts`
  - **Não execute até o William entregar os arquivos.** Deixe a tarefa desmarcada.
  - **Faça**, quando chegarem: se os arquivos tiverem os mesmos nomes e a mesma proporção
    (770 × 290), sobrescreva os dois em `public/logos/`. Se o nome ou a proporção mudarem, edite
    **só** `brand-assets.ts` (`LOGO.onLight`, `LOGO.onDark`, `LOGO.width`, `LOGO.height`). Se o
    desenho do focinho mudar: atualize `public/logos/logo-compact.svg`, o `FOCINHO.path` (e o
    `viewBox`, se mudar) em `brand-assets.ts` e rode `node scripts/generate-icons.mjs`.
  - **Feito quando**: `npm test -- --watch=false`, `npx playwright test e2e/login-ui.spec.ts` e
    `npm run check:ui` passam, e a busca por `/logos/` em `src/` só acha `brand-assets.ts`.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (T001–T002)**: sem dependências.
- **Fundação (T003–T015)**: depende do Setup. **Bloqueia todas as histórias.** A T003 (spike)
  bloqueia tudo o que vem depois dela.
- **US1 (T016–T030)**: depende da Fundação.
- **US2 (T031–T039)**: depende da US1 (usa botão, campo, caixa, aviso, aviso temporário, logo,
  focinho, painel de marca, "G" do Google).
- **US3 (T040–T050)**: depende da US1; a T046 usa a página inicial já sem PrimeNG (T035, US2).
  Por isso a US3 vem depois da US2.
- **US4 (T051–T056)**: depende da US3 (casca do tutor e galeria) e da US1 (diálogo).
- **US5 (T057–T062)**: depende só da Fundação. Pode ser feita em qualquer momento depois da US2
  (a T062 edita o script criado na T038).
- **Acabamento (T063–T070)**: depende de todas as histórias. A T070 fica bloqueada.

### Dentro da Fundação (ordem obrigatória)

`T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T014 → T015`.
A T013 pode entrar em qualquer ponto depois da T004.

### Dentro das histórias

- **US1**: T016 primeiro. T017 antes de T021. T025 antes de T026. T016 antes de T023, T026 e
  T028. T029 depois de todas as de componente. T030 por último.
- **US2**: T031 → T032 → T033. T034, T035 e T036 em qualquer ordem. T037 depois de T031 a T036.
  T038 depois de T037. T039 depois de T032.
- **US3**: T040 primeiro. T041 a T044 depois. T045 depois de T041 e T043. T046 depois de T044.
  T047 em qualquer ponto. T048 depois de T041 a T044. T049 depois de T048. T050 por último.
- **US4**: T051 → T052 → T053. T054 depois de T051. T055 depois de T053 e T054. T056 no fim.
- **US5**: T057 → T058 → T059. T060 → T061. T062 no fim.

### Tarefas que podem rodar em paralelo

Só vale se quem executa conseguir trabalhar em arquivos diferentes ao mesmo tempo; um executor
único faz na ordem numérica.

| Fase | Grupo paralelo |
|---|---|
| Setup | T002 (com a T001 já concluída) |
| Fundação | T013 (com qualquer tarefa depois da T004) |
| US1 | T017, T018, T019, T020, T022, T024, T025, T027 entre si (depois da T016) |
| US2 | T034, T035, T036 entre si (depois da T032) |
| US3 | T042, T043, T044 entre si (depois da T040) |
| US4 | T054 (depois da T051) |
| Acabamento | T064, T065, T066, T067, T068 entre si |

Nenhuma tarefa que mexe em `package.json` está marcada `[P]`.

---

## Implementation Strategy

### Mínimo entregável (só a US1)

1. Setup e Fundação (T001–T015). Se o spike parar, a feature para aqui.
2. US1 (T016–T030).
3. **Pare e valide**: `/dev/ui/components`, `npm run check:ui`, `e2e/ui-identity.spec.ts`.
   Neste ponto o produto ainda tem o login em PrimeNG, mas a base nova está pronta.

### Entrega incremental

1. Fundação + US1 → base visual pronta.
2. + US2 → login com a cara nova; PrimeNG fora. **Primeiro ponto em que vale mostrar ao William.**
3. + US3 → cascas; as specs 003 e 004 já podem começar.
4. + US4 → tema escuro.
5. + US5 → sem service worker; ícones.
6. Acabamento.

Cada passo termina com o projeto verde (regra 5).

---

## Verificação final

Rode na ordem, um comando por linha. Todos têm de sair com código 0.

```bash
npm run build
npm run lint
npm test -- --watch=false
npm run check:ui
npm run build:stats
npm run check:bundle
node scripts/ui-checks/public-bundle.mjs --self-test
npm run e2e
```

Depois confira, um por um:

- [ ] `package.json` não contém `primeng`, `primeicons`, `@primeuix`, `@angular/service-worker`,
      `lucide` nem `fontsource`.
- [ ] `angular.json` → `styles` é `["src/styles.css"]`; não há `serviceWorker`; a produção tem
      `inlineCritical: false`.
- [ ] Não existem: `src/styles/`, `src/theme/`, `ngsw-config.json`,
      `src/app/features/health-records/`, `src/app/features/reminders/`,
      `src/app/features/subscription/`, `src/app/shared/index.ts`.
- [ ] Existem: `public/ngsw-worker.js` (com `registration.unregister`), `public/fonts/` com quatro
      `.woff2` e `OFL.txt`, `public/favicon.svg`, `components.json`, `.postcssrc.json`.
- [ ] `git diff src/app/features/auth/login/login.spec.ts` remove só o import de `primeng/api` e
      o provider `MessageService`.
- [ ] `git status --short supabase` está vazio. `git diff vercel.json` está vazio.
- [ ] A busca por `/logos/` em `src/` só acha
      `src/app/shared/components/faro/logo/brand-assets.ts`.
- [ ] `src/app/app.html` contém só `<router-outlet />`.
- [ ] `specs/002-ui-zardui/execution-log.md` tem a linha de base, o spike aprovado, os desvios,
      as regras de lint desligadas e o resultado final com a tabela "antes × depois".
- [ ] A T070 continua desmarcada, com a nota de que depende do William.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência e sem mexer em `package.json`.
- O rótulo `[USn]` liga a tarefa à história da `spec.md`.
- Escreva o teste junto com a tarefa e veja-o falhar antes de implementar, quando a tarefa pedir
  teste de unidade.
- Pare em qualquer checkpoint para validar a história sozinha.
- Evite: tarefa vaga, dois executores no mesmo arquivo, "aproveitar para melhorar" algo que não
  está na tarefa.
- Da pasta `design/`, só `design/telas-v2/` e `design/telas-v2-gerador/` são versionadas (o resto
  é ignorado pelo `.gitignore`). Se as telas não estiverem na sua máquina, os contratos têm todas
  as medidas; não é motivo de parada.
