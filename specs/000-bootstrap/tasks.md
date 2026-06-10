# Tasks: Bootstrap do projeto (Angular 21)

**Input**: [`plan.md`](plan.md) · **Owner**: `frontend-angular` · **Tests**: smoke + **`ng build`** (a suíte completa vem com as features)
**Status**: ✅ **CONCLUÍDO** em 2026-06-10 — `ng build` / `ng lint` / `ng test` verdes (ver "Status de execução").

> Consulte o skill `.agents/skills/angular-developer/` e as `references/` indicadas antes de cada passo.
> `[P]` = paralelizável.

## Phase 1: Setup
- [x] **T001** Scaffold em pasta temporária: `npx @angular/cli@21 new faro --style=css --ssr --zoneless --skip-git`. Mover os arquivos gerados para a raiz `pet-app/`, **reintegrando** `src/styles/` e `src/theme/` existentes (sem sobrescrever). Ref.: `cli.md`.
- [x] **T002** Confirmar **zoneless**: `provideZonelessChangeDetection()` em `app.config.ts`; garantir ausência de `zone.js` em polyfills/`angular.json`.
- [x] **T003** Instalar PrimeNG: `npm i primeng @primeng/themes primeicons`. _(desvio: PrimeNG 21 deprecou `@primeng/themes` → usado **`@primeuix/themes`**; `faro-preset.ts` migrado.)_
- [x] **T004** [P] Tooling: `ng add @angular-eslint/schematics` · `ng add @angular/localize` · `ng add @angular/pwa` · `npm i -D @playwright/test && npx playwright install` · configurar **Vitest** como runner de unit. Ref.: `testing-fundamentals.md`. _(Vitest já é o default do builder `@angular/build:unit-test`; Playwright instalado só com Chromium.)_

## Phase 2: Foundational
- [x] **T005** `app.config.ts`: `providePrimeNG({ theme: { preset: FaroPreset, options: { darkModeSelector: '.faro-dark' } } })` (import de `src/theme/faro-preset.ts`); `provideClientHydration(withIncrementalHydration(), withEventReplay())`; `provideZonelessChangeDetection()`; `provideRouter(...)`; `provideAnimationsAsync()` se o PrimeNG exigir. Ref.: `defining-providers.md`. _(PrimeNG 21 não exigiu `provideAnimationsAsync`; PrimeNG isolado em `@layer primeng`.)_
- [x] **T006** Estilos globais: incluir `src/styles/faro-ds.css` + `primeicons/primeicons.css` em `angular.json > styles` (ou `@import` em `src/styles.css`).
- [x] **T007** Fontes em `src/index.html`: `<link>` Google Fonts (Poppins 500/600/700 · Inter 400/500/600/700 · JetBrains Mono 400/500) com `preconnect`; `lang="pt-BR"`. _(self-host das fontes fica como otimização futura — docs/frontend.md §732.)_
- [x] **T008** `app.routes.ts` + `app.routes.server.ts`: **render mode por rota** — landing `Prerender`; público `/:codigo` e `/:codigo/perdido` `Server` (SSR); `/app/**`, `/admin/**`, `/auth/**` `Client` (CSR lazy via `CanMatch`). Rotas-esqueleto com componentes placeholder. Ref.: `rendering-strategies.md`, `route-guards.md`, `define-routes.md`. _(painel/admin/auth como rotas estáticas lazy ANTES de `:codigo`; guards `CanMatch` chegam na feature de auth.)_
- [x] **T009** Estrutura de pastas: criar `core/`, `shared/`, `models/`, `features/{pets,health-records,subscription,reminders,admin}`, `features/public/{landing,rescue-page}` com componentes/barrels placeholder.
- [x] **T010** ESLint **boundaries**: regra `no-restricted-imports` (ou `eslint-plugin-boundaries`) impedindo `features/public/**` de importar painel, `core/auth`, `core/billing` (invariante Rescue-First / two-bundle).
- [x] **T011** `core/` base: `SupabaseService` (cliente com **apenas anon key** via `environment`); `ErrorHandler` global + logging básico; `environment.ts`/`environment.development.ts` com placeholders (**sem segredos**). Ref.: `creating-services.md`. _(SupabaseService SSR-safe: não persiste sessão no servidor.)_
- [x] **T012** [P] Componentes placeholder de `features/public/landing` e `features/public/rescue-page` (SSR) só para validar render mode + tema (FaroPreset/faro-ds.css aplicados).
- [x] **T013** **`ng build`** (DEVE passar) + `ng test` smoke; corrigir erros antes de concluir (passo obrigatório do skill).

**Checkpoint**: fundação pronta → as specs de feature (`001+`) podem começar.

## Dependências
`T001` → `T002`/`T003`/`T004` → `T005`–`T012` → `T013`. `T004` e `T012` são `[P]`.

## Definição de pronto (DoD)
- [x] `ng build` (com SSR) **verde**; `ng test` smoke verde. → build 457 kB raw / 107 kB transfer; **6/6 testes**.
- [x] PrimeNG renderizando com a cor primária **Índigo** (FaroPreset); `faro-ds.css` + fontes carregando.
- [x] Render mode por rota funcionando (rota pública via SSR; painel via CSR lazy). → **1 rota prerenderizada** (landing).
- [x] ESLint boundaries ativo; estrutura de pastas do `CLAUDE.md` criada. → `ng lint` verde.
- [x] Nenhum segredo no repositório. → só anon-key placeholders; `dist`/`node_modules` no `.gitignore`.

## Status de execução (2026-06-10)
**Gates**: `ng build` ✅ (457 kB raw / 107 kB transfer inicial; 1 rota prerenderizada) · `ng lint` ✅ (all files pass) · `ng test` ✅ (6/6 testes em 6 arquivos, Vitest).

**Stack final**: Angular 21.2 (zoneless, SSR híbrido) · PrimeNG 21.1 + **`@primeuix/themes`** (FaroPreset/Aura) · `@supabase/supabase-js` 2.x · ESLint flat (angular-eslint 21) + boundary Rescue-First · Vitest · Playwright (Chromium) · `@angular/localize` (PT-BR) · PWA.

**Desvios do texto original** (justificados):
1. `@primeng/themes` (deprecado no v21) → `@primeuix/themes`. ⇒ atualizar referências da spec/docs.
2. Playwright: só Chromium instalado (`npx playwright install` para os demais).
3. Fontes via Google Fonts CDN (self-host = otimização futura, docs/frontend.md §732).
4. Instalado o SDK real `@supabase/supabase-js` (a spec previa "stub"); `SupabaseService` já SSR-safe e tree-shakeável.

**Pendências para as features (fora do escopo do bootstrap)**:
- Guards `CanMatch` reais nas rotas `app/**`/`admin/**`/`auth/**` (feature de auth).
- Valores reais de Supabase nos `environments` (hoje placeholders).
- Telemetria/Sentry plugada no `GlobalErrorHandler` (feature de observabilidade).
