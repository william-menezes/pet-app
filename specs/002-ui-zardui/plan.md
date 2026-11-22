# Implementation Plan: Migração de UI para ZardUI + Tailwind v4, com a nova identidade

**Branch**: `002-ui-zardui` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-ui-zardui/spec.md`

## Summary

Trocar a base de interface do Faro: sai **PrimeNG 21** (com `@primeuix/themes`, PrimeIcons,
`FaroPreset`, `faro-ds.css` e `faro-shells.css`) e entra **ZardUI** (código dos componentes copiado
para o repositório pelo `zard-cli`) sobre **Tailwind CSS v4**, com a identidade fechada em
2026-11-21 (lima age, tinta seleciona, navy é marca, âmbar só no modo perdido; Outfit e Inter).

O que a feature entrega, em ordem:

1. **Base visual única**: um arquivo de tema (`src/styles.css`) com tokens claros e escuros,
   fontes no próprio domínio, ícones Boxicons, 18 componentes do ZardUI editados e 12 componentes
   de marca do Faro.
2. **Login migrado** para o desenho aprovado (`V2-entrar*`), nas três larguras, sem mudar o
   comportamento nem os `data-testid`; PrimeNG removido do projeto.
3. **Cascas responsivas**: app do tutor, fluxos, admin e páginas públicas, em celular, tablet
   (`md`, 768px) e desktop (`xl`, 1280px), com a fronteira Rescue-First provada por lint e pelo
   pacote gerado.
4. **Tema escuro** só dentro do app do tutor, com preferência por aparelho (`ThemeService`).
5. **Sem service worker**, com desligamento dos já instalados, e ícones do app com o focinho.

Não há mudança de banco nem de backend. É a fundação das specs `003-tag-qr` e `004-conta-tutor`.

## Technical Context

**Language/Version**: TypeScript ~5.9 estrito; Angular **21.2** (standalone, signals, zoneless),
SSR híbrido com `@angular/ssr` 21.2. Node 24, npm 11.
**Primary Dependencies (entram)**: `tailwindcss` 4.x + `@tailwindcss/postcss` + `postcss` +
`tailwindcss-animate` (dev); **ZardUI** por `zard-cli@1.12.0` (não é dependência: copia código);
`@angular/cdk` ^21; `class-variance-authority`; `clsx`; `tailwind-merge`; `@ng-icons/core` ^34;
`@boxicons/js` 1.0.1; `ngx-sonner` ^3 (trazido pelo `sonner`); `@axe-core/playwright` (dev).
**Primary Dependencies (saem)**: `primeng`, `@primeuix/themes`, `primeicons`,
`@angular/service-worker`; `@ng-icons/lucide` entra com o `init` e sai na mesma fase.
**Storage**: nenhum no servidor. No navegador, `localStorage['faro.theme']` (preferência de tema).
**Testing**: Vitest pelo `@angular/build:unit-test` (`npm test -- --watch=false`); Playwright
(Chromium) com `@axe-core/playwright`; ESLint (`npm run lint`); scripts de Node em
`scripts/ui-checks/` para tokens, contraste, restos da pilha antiga, fronteira de imports e
fronteira no pacote.
**Target Platform**: web responsivo, mobile first. Rotas públicas com SSR/pré-render; app
autenticado, admin e login com CSR. Hospedagem Vercel.
**Project Type**: aplicação web única (frontend em `src/`, backend em `supabase/`, este último
intocado).
**Performance Goals**: página pública inicial com peso transferido menor ou igual ao de antes da
migração; duas requisições de fonte na página de resgate; login interativo em até 3 s em 4G
(mantém a SC-003 da spec 001).
**Constraints**: CSP estrita mantida (`script-src 'self'`); um único arquivo de tema; `.dark`
nunca em `:root`; página pública sem overlay e sem código do app autenticado; alvos de toque de
44px; contraste 4,5:1 (texto) e 3:1 (controles) nos dois temas; todos os testes existentes do
login continuam passando; `ng build`, `npm run lint`, `npm test -- --watch=false` e o smoke do
Playwright verdes ao fim de **cada** fase.
**Scale/Scope**: 1 tela real migrada (login) + retorno do Google + 3 telas provisórias
(página inicial, app, admin); 18 componentes do ZardUI; 12 componentes próprios; 4 cascas;
1 serviço; 4 scripts de checagem; 8 páginas de galeria de desenvolvimento. Cerca de 70 tarefas.

Detalhes e alternativas: [research.md](./research.md). Valores e APIs: [contracts/](./contracts/).

## Constitution Check

*GATE: percorre cada princípio da constituição v2.0.0. Reavaliado depois do desenho (contratos):
mantém-se aprovado.*

### I. Segurança do Pet Acima de Tudo (Rescue-First) — NÃO-NEGOCIÁVEL — PASS

- A rota pública (`/:codigo`) não ganha dependência nova: nem do tema escuro, nem de overlays, nem
  do app autenticado. Isso é provado duas vezes: `no-restricted-imports` em `features/public/**`
  (atualizado para as pastas novas) e uma checagem do pacote gerado
  (`scripts/ui-checks/public-bundle.mjs`).
- A remoção do service worker **reduz** risco para o resgate: deixa de existir cache que pudesse
  servir uma página de resgate desatualizada. Os workers já instalados são desligados
  (`public/ngsw-worker.js`), e isso é testado.
- O achado de `research.md` §R9 (CSS crítico embutido bloqueado pela CSP) é corrigido aqui;
  sem a correção, telas ficariam sem estilo em produção.
- Nada aqui depende de cobrança ou entitlement.

### II. Privacidade & LGPD por Design — NÃO-NEGOCIÁVEL — PASS

- Nenhum dado pessoal novo. A preferência de tema é configuração funcional do aparelho, fica só no
  navegador e não vai ao servidor.
- As fontes passam a ser servidas pelo próprio domínio: quem acha o pet deixa de ter o IP enviado
  ao Google ao abrir a página.
- Os dados de exemplo da galeria são fictícios (Ana, Paçoca, tag de exemplo).

### III. Segurança em Profundidade & RLS-First — NÃO-NEGOCIÁVEL — PASS

- `supabase/` não é tocado: nenhuma tabela, política, RPC ou segredo muda.
- A CSP continua `script-src 'self'`, sem `unsafe-inline` nem `unsafe-eval`. A correção do CSS
  crítico foi escolhida para **não** afrouxá-la.
- As regras de ESLint contra XSS e de isolamento do token (`localStorage` só em `core/`) continuam
  valendo; o `ThemeService` mora em `core/theme/` por causa delas.
- Risco novo, declarado: o `zard-cli` baixa código de um registro remoto sem hash. Contrapartida:
  versão do CLI fixa, revisão do diff contra lista de imports permitidos, código commitado,
  `npm audit` (ver `research.md` §R2 e §R19).

### IV. Spec-Driven Development — PASS

- `spec.md` é agnóstica de stack (sem nome de biblioteca, de arquivo ou de variável). A stack está
  neste plano, em `research.md` e nos contratos.
- Fluxo seguido: spec → plan (+ research, data-model, contracts, quickstart) → tasks. A
  implementação só começa com a aprovação do William.

### V. Mobile-First, Performance & Acesso Universal — PASS

- Toda casca e a tela de login são definidas em três larguras, com a base no celular, e testadas
  em 320, 390, 768 e 1440px.
- Rotas públicas continuam com SSR/pré-render; o app autenticado continua CSR. As primitivas de
  página pública não têm overlay e funcionam antes da hidratação.
- **O MVP fica sem service worker**; ficam o manifest e os ícones.
- A página pública é sempre clara; o tema escuro só existe dentro da casca do tutor.
- WCAG 2.1 AA: contraste conferido por script nos dois temas, foco visível por regra global, alvos
  de 44px, axe no login e na galeria, `prefers-reduced-motion` respeitado.
- i18n: texto fixo marcado para tradução (`i18n`, `$localize`); PT-BR é o idioma de origem.

### VI. Simplicidade & Entrega Incremental (MVP-First / YAGNI) — PASS, com desvios justificados

- Cinco histórias independentes (P1 a P3), cada uma entregável e testável sozinha.
- Só entram componentes usados por telas aprovadas do MVP. Ficam de fora variantes mortas
  (`accent`, `whatsapp`), tokens sem uso (`--info`, `--whatsapp`, `--shadow-card`) e ícones do
  roadmap.
- **Sai código do roadmap**: os stubs `features/health-records`, `features/reminders` e
  `features/subscription`.
- Desvios registrados em *Complexity Tracking*: a galeria de desenvolvimento, os scripts de
  checagem e o arquivo de desligamento do worker.

### VII. Observabilidade, Auditoria & Confiabilidade — PASS

- Nenhum evento sensível novo. O `GlobalErrorHandler` não muda.
- Estados vazios e de erro terminam num próximo passo (regra do contrato de componentes;
  `ShellFallback` tem botão de volta).
- A limpeza de service workers no carregamento fica em `try/catch`: nunca derruba a página.

### VIII. O Que É Impresso É Para Sempre — NÃO-NEGOCIÁVEL — PASS

- Nada do contrato físico muda: domínio, URL, formato do código, normalização e QR ficam como
  estão. A rota `/:codigo` não é alterada (a spec 003 cuida dela).
- Os caminhos novos na raiz são arquivos estáticos (`/ngsw-worker.js`, `/favicon.svg`,
  `/fonts/*`), que têm ponto e nunca casam com um código de 9 caracteres Crockford. A galeria usa
  `/dev/ui/...` (dois ou mais segmentos) e só existe em build de desenvolvimento.
- O código da tag passa a ser exibido em Outfit, não em monoespaçada: muda a fonte na tela, não o
  valor nem a formatação `XXXX-XXXX-X`.

**Resultado do GATE: APROVADO.** Nenhum princípio inegociável é violado. Há três desvios de
simplicidade, justificados abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-zardui/
├── spec.md                          # o quê e por quê, sem stack
├── plan.md                          # este arquivo
├── research.md                      # decisões, alternativas, armadilhas, trade-offs de segurança
├── data-model.md                    # sem banco; entidades de interface
├── quickstart.md                    # como rodar, ver e verificar
├── contracts/
│   ├── design-tokens.contract.md    # tokens, conteúdo de src/styles.css, contraste
│   ├── shared-components.contract.md# ícones, componentes ZardUI e próprios, tela de login
│   └── shells.contract.md           # cascas, tema escuro, rotas, galeria, fronteira pública
├── checklists/requirements.md       # qualidade da spec
├── tasks.md                         # tarefas por história
└── execution-log.md                 # criado por quem executa: linha de base, spike, desvios
```

### Source Code (repository root)

Legenda: `[N]` novo · `[E]` editado · `[X]` removido · `[CLI]` criado pelo `zard-cli`.

```text
pet-app/
├── components.json                              [CLI] aliases do ZardUI
├── .postcssrc.json                              [CLI] Tailwind pelo PostCSS
├── package.json                                 [E] dependências; scripts check:* e build:stats
├── angular.json                                 [E] styles = [src/styles.css]; sem serviceWorker; inlineCritical: false
├── tsconfig.json                                [CLI] paths "@/*" → src/app/*
├── eslint.config.js                             [E] exceção p/ código do ZardUI; fronteira pública nova
├── ngsw-config.json                             [X]
├── playwright.config.ts                         (sem mudança)
├── scripts/
│   ├── generate-icons.mjs                       [N] PNGs, favicon.svg e favicon.ico a partir do focinho
│   └── ui-checks/
│       ├── tokens.mjs                           [N] valores, contraste, arquivo único de tema
│       ├── removed-stack.mjs                    [N] sem PrimeNG, sem SW, sem identidade antiga, .dark só na casca
│       ├── boundary.mjs                         [N] regra de imports de features/public
│       └── public-bundle.mjs                    [N] fronteira no pacote (dist/faro/stats.json)
├── e2e/
│   ├── smoke.spec.ts                            (sem mudança)
│   ├── support/ui.ts                            [N] larguras, axe, rolagem horizontal
│   ├── dev-gallery.spec.ts                      [N]
│   ├── ui-identity.spec.ts                      [N] cores, foco, toque, fontes, axe
│   ├── login-ui.spec.ts                         [N] login nas três larguras, axe
│   ├── ui-shells.spec.ts                        [N] cascas por largura
│   ├── ui-theme.spec.ts                         [N] escuro só no app do tutor
│   └── legacy-sw.spec.ts                        [N] worker antigo se desliga
├── public/
│   ├── fonts/                                   [N] 4 woff2 variáveis + OFL.txt
│   ├── ngsw-worker.js                           [N] arquivo de desligamento do worker antigo
│   ├── favicon.svg                              [N]
│   ├── favicon.ico                              [E] gerado do focinho
│   ├── manifest.webmanifest                     [E]
│   ├── icons/                                   [E] 192, 512, maskable-192, maskable-512, apple-touch-icon, favicon-32; [X] os demais
│   └── logos/                                   (sem mudança; aguardando o novo wordmark)
└── src/
    ├── index.html                               [E] sem Google Fonts; preload das fontes; ícones; theme-color
    ├── main.ts                                  [E] chama a limpeza de service workers
    ├── server.ts                                [E] só o comentário da CSP
    ├── styles.css                               [E] ÚNICO arquivo de tema
    ├── styles/                                  [X] faro-ds.css, faro-shells.css, README.md
    ├── theme/                                   [X] faro-preset.ts
    └── app/
        ├── app.config.ts                        [E] provideZard, provideIcons; sem PrimeNG e sem service worker
        ├── app.routes.ts                        [E] hospedeiros /app e /admin, galeria só em dev
        ├── app.routes.server.ts                 [E] app/** e admin/** como Client
        ├── core/
        │   ├── auth/, supabase/, error/         (sem mudança)
        │   ├── theme/theme.service.ts           [N] + spec
        │   └── pwa/unregister-service-workers.ts[N] + spec
        ├── shared/
        │   ├── index.ts                         [X] barrel vazio que citava PrimeNG
        │   ├── core/                            [CLI] provider, diretivas, css/zard.css
        │   ├── utils/                           [CLI] mergeClasses etc.
        │   ├── icons/faro-icons.ts              [N] + spec
        │   ├── components/
        │   │   ├── button/ input/ input-group/ textarea/ field/ checkbox/ switch/ toggle/
        │   │   │   toggle-group/ badge/ alert/ alert-dialog/ card/ item/ empty/ sonner/
        │   │   │   spinner/ skeleton/ input-otp/            [CLI] + [E] variantes do Faro
        │   │   └── faro/
        │   │       ├── logo/ (logo.ts, brand-assets.ts)     [N]
        │   │       ├── focinho/  brand-panel/ (+ brand-copy.ts)  brand-mark/  google-glyph/   [N]
        │   │       └── icon-tile/ info-card/ note/ stat-tile/ steps/ pet-hero/ action-card/   [N]
        │   └── shells/
        │       ├── nav-item.ts  leaf-route-data.ts          [N]
        │       └── tutor-shell/ screen-header/ flow-shell/ admin-shell/ public-layout/ shell-fallback/  [N]
        ├── features/
        │   ├── public/landing/                  [E] usa app-public-layout; sem PrimeNG
        │   ├── public/rescue-page/              (sem mudança; é da spec 003)
        │   ├── auth/login/                      [E] login.ts, login.html, login.spec.ts; [X] login.css
        │   ├── auth/callback/oauth-callback.ts  [E]
        │   ├── pets/pets/                       [E] pets.ts, pets.html; [X] pets.css
        │   ├── pets/tutor-app/tutor-app.ts      [N] hospedeiro de /app
        │   ├── admin/admin/                     [E] admin.html
        │   ├── admin/admin-app/admin-app.ts     [N] hospedeiro de /admin
        │   ├── dev-gallery/                     [N] só em build de desenvolvimento
        │   ├── health-records/                  [X]
        │   ├── reminders/                       [X]
        │   └── subscription/                    [X]
        └── models/index.ts                      [E] só o comentário
```

`supabase/` inteiro, `tools/`, `docs/` e `design/`: **sem mudança**. `CLAUDE.md` e a memória do
agente `frontend-angular` são atualizados na fase de acabamento.

**Structure Decision**: aplicação web única, como já é o repositório. Segue o `CLAUDE.md`
(`shared/components/` para ZardUI copiado e componentes próprios; `shared/icons/`), com três
confirmações deste plano: (1) os componentes próprios ficam em `shared/components/faro/`, para o
ESLint distinguir o código copiado do ZardUI do código do Faro; (2) as cascas ficam em
`shared/shells/`; (3) o serviço de tema fica em `core/theme/`. As pastas `core` e `utils` dentro de
`shared/` são do ZardUI (o CLI as cria ali pelos aliases padrão); não confundir com `src/app/core/`.
O alias `@/` aponta para `src/app/`.

## Ordem de entrega e "verde em cada fase"

| Fase | O que convive | Estado ao fim |
|---|---|---|
| Setup | tudo como hoje | linha de base medida; stubs do roadmap fora |
| Fundação | Tailwind e ZardUI **junto** com PrimeNG (`angular.json` ainda lista `primeicons` e `faro-ds.css`) | tema, fontes, ícones e galeria prontos; build verde |
| US1 | idem | componentes prontos e visíveis na galeria |
| US2 | PrimeNG sai **nesta fase**, depois de login e página inicial migrados | nenhum import de PrimeNG; checagem `check:stack` criada |
| US3 | — | cascas ligadas às rotas; fronteira pública provada |
| US4 | — | tema escuro no app do tutor |
| US5 | service worker sai | sem service worker; ícones novos |
| Acabamento | — | documentação, i18n, verificação final |

A remoção do PrimeNG e a checagem "não sobrou PrimeNG" entram na mesma fase (US2), para nenhuma
fase terminar vermelha.

## Riscos

| Risco | Probabilidade | Efeito | Resposta |
|---|---|---|---|
| ZardUI não instala ou não compila no Angular 21 | baixa (o CLI fixa versões para o 21) | bloqueia tudo | spike T003, com parada e relatório |
| Código copiado do ZardUI reprova no ESLint do projeto | alta | lint vermelho | bloco de exceção restrito ao código copiado (T006) |
| API de um componente do ZardUI diferente do esperado | média | tarefa trava | o contrato fixa o resultado, não a API; a tarefa manda ler o arquivo copiado |
| CSS crítico embutido bloqueado pela CSP | certa, se nada for feito | telas sem estilo em produção | T013 + checagem no pacote |
| Worker antigo continua servindo a versão velha | certa, se só apagar | usuários presos | arquivo de desligamento + teste (T057–T059) |
| Diálogo claro dentro do app escuro | certa, se nada for feito | defeito visual e de contraste | classe replicada no contêiner de overlays (T053) |
| Tailwind varre `docs/` e `specs/` | certa, se nada for feito | CSS inchado | `source('.')` + canário |
| Trabalho do pivô ainda não commitado se perder | média | perda de documentos | spike em cópia de trabalho separada; comandos destrutivos do git proibidos |
| Instruções antigas dos agentes mandam usar PrimeNG | certa | executor confuso | regra explícita no topo do `tasks.md` |

## Complexity Tracking

> Nenhum princípio inegociável é violado. Três desvios de simplicidade e duas exceções declaradas.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Galeria de desenvolvimento** (`features/dev-gallery`, 8 páginas) que nenhum usuário vê | O app do tutor e o admin exigem sessão e as telas reais são das specs 003 e 004. Sem a galeria não há como ver nem testar sozinho (três larguras, tema escuro, axe) as cascas e os componentes desta entrega | Só testes de unidade: jsdom não calcula layout, largura de tela nem cor resolvida. Storybook: outra dependência, outro build e outra configuração do Tailwind |
| **Quatro scripts de checagem** em `scripts/ui-checks/` além dos testes | As regras desta feature são sobre o projeto inteiro (um arquivo de tema, nenhuma cor solta, nada do PrimeNG, fronteira no pacote), não sobre um componente. Precisam ler arquivos do disco e o `stats.json` do build | Testes do Vitest: rodam em jsdom, sem os tipos de `node:fs` no `tsconfig.spec.json`, e não enxergam o resultado do build |
| **`public/ngsw-worker.js`** num produto "sem service worker" | Navegadores que já registraram o worker antigo só o largam se o mesmo endereço entregar um script que se desregistra. Sem o arquivo, o endereço cai na rota `/:codigo` e o worker antigo vive para sempre | Só apagar o worker: deixa usuários presos na versão antiga, inclusive na página de resgate (Princípios I e V) |
| **Código de terceiro copiado de um registro remoto** (ZardUI) | É o modelo da biblioteca escolhida pela constituição v2.0.0: o código mora no repositório e é editado ali | Biblioteca instalada pelo npm (PrimeNG): é exatamente o que está sendo trocado, porque não permite aplicar as regras do Faro nas variantes |
| **Dois nomes para a mesma escala** (`navy-*` e `indigo-*`) | `docs/decisoes-pivo.md` decidiu manter `indigo-*` como apelido; `DESIGN.md` proíbe "os tons antigos de índigo". `navy-*` é o nome usado em código novo; `indigo-*` aponta para os mesmos valores | Só `indigo-*`: nome que contradiz a marca. Só `navy-*`: descumpre a decisão registrada |

**Dívidas encontradas e não resolvidas aqui** (registradas, com dono sugerido): guards de
autenticação no pacote inicial da página pública e scripts embutidos do *event replay* bloqueados
pela CSP. Ambas tocam a página de resgate e ficam para a spec 003 (`research.md` §R9 e §R15).
