# Implementation Plan: Bootstrap do projeto (Angular 21)

**Tipo**: Setup / Foundational (NÃO é feature spec — sem user stories) · **Data**: 2026-06-07 · **Owner**: `frontend-angular`
**Input**: "Criar o projeto Angular 21 seguindo as boas práticas do `angular-developer` skill"

> Este é o **bootstrap** da aplicação — a fase Setup/Foundational que antecede todas as features.
> Não há `spec.md` (não é funcionalidade voltada ao usuário); as tarefas estão em [`tasks.md`](tasks.md).
> O agente **`frontend-angular`** executa, consultando o skill `.agents/skills/angular-developer/`
> (e suas `references/`) e os docs do projeto (`CLAUDE.md`, `docs/frontend.md`, `docs/architecture.md`).

## Summary
Scaffold do app **Angular 21** (renderização **híbrida SSR/CSR**, **zoneless**, signals) com **PrimeNG (tema Aura)**
via `FaroPreset`, integrando o design system já implementado (`src/styles/faro-ds.css`, `src/theme/faro-preset.ts`),
a estrutura de pastas do `CLAUDE.md` e o tooling de qualidade (ESLint com *boundaries*, Vitest, Playwright,
i18n PT-BR, PWA). Encerra com **`ng build`** verde.

## Technical Context
- **Framework**: Angular 21 (standalone, signals, **zoneless**), TypeScript estrito.
- **UI**: PrimeNG + `@primeng/themes` (Aura) + PrimeIcons. Fontes **Poppins + Inter** (+ JetBrains Mono).
- **Renderização**: `@angular/ssr` — **render mode por rota** (público SSR/prerender; painel CSR).
- **Testes**: **Vitest** (unit), **Playwright** (e2e).
- **Qualidade**: ESLint (`@angular-eslint`) + regra de *boundaries* (`features/public` não importa painel/`core/auth`/`core/billing`).
- **i18n**: `@angular/localize`, fonte **PT-BR**. **PWA**: `@angular/pwa`.
- **Dados**: cliente Supabase (**somente anon key**) como *stub* em `core/`; integração real nas features.
- **Host**: Vercel (build SSR). **Node**: 22.x (verificado: Node v22.22, npm 10.9, Angular CLI presente).
- Versão pedida = **21** → usar `npx @angular/cli@21` (regra do skill para versão específica).

## Constitution Check (GATE)
- **I. Rescue-First** ✓ base do "two-bundle": `features/public` (SSR) isolado do painel via *boundary* no ESLint.
- **II. LGPD** ✓ bootstrap não trata PII; `lang="pt-BR"`; consentimento virá nas features.
- **III. RLS-first/segurança** ✓ cliente só com **anon key**; nenhum segredo no repo; `environment` com placeholders.
- **IV. Spec-Driven** ✓ registrado como Setup/Foundational (este plan+tasks), antecede as features.
- **V. Mobile-first/perf/a11y** ✓ SSR nas rotas públicas, render mode por rota, PWA, i18n.
- **VI. Simplicidade/MVP** ✓ sem libs de estado externas (signals); scaffold mínimo.
- **VII. Observabilidade** ✓ `ErrorHandler` global + logging básico na fundação.
- **Sem violações** → Complexity Tracking vazio.

## Project Structure (alvo — `CLAUDE.md`)
```text
pet-app/
├── src/
│   ├── app/
│   │   ├── core/            # supabase (anon), guards, interceptors, error handler, billing port
│   │   ├── shared/          # wrappers PrimeNG, pipes, utils
│   │   ├── features/
│   │   │   ├── pets/  health-records/  subscription/  reminders/  admin/
│   │   │   └── public/{landing, rescue-page}
│   │   ├── models/
│   │   ├── app.config.ts        # providePrimeNG(FaroPreset) · zoneless · hydration · localize
│   │   ├── app.routes.ts        # rotas
│   │   └── app.routes.server.ts # render mode por rota (prerender/server/client)
│   ├── styles/   # faro-ds.css, faro-shells.css  (JÁ EXISTEM)
│   ├── theme/    # faro-preset.ts                (JÁ EXISTE)
│   ├── index.html (fontes), main.ts, main.server.ts, server.ts
├── supabase/     # migrations/, functions/  (criados nas features de backend)
├── e2e/          # Playwright
└── angular.json · package.json · eslint config · vitest config
```

## Notas de execução
- `ng new` **não roda em pasta não vazia**: fazer **scaffold em pasta temporária → mover para a raiz `pet-app/` → reintegrar** `src/styles/` e `src/theme/` (não sobrescrever). Garantir que `angular.json > styles` inclua `src/styles/faro-ds.css`.
- Consultar no skill: `references/rendering-strategies.md`, `route-guards.md`, `defining-providers.md`, `signal-forms.md`, `testing-fundamentals.md`, `cli.md`.
- **Não** é uma tela → o *gate de revisão de design* não se aplica; o gate aqui é **`ng build` verde** + sua revisão da estrutura.
