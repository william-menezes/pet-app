---
name: repo-structure
description: Faro confirmed repo layout, English feature names, and the core/ vs features/auth reconciliation
metadata:
  type: project
---

Real layout confirmed (after 000-bootstrap, single root, no more pet-app/pet-app nesting):

- Frontend: `src/app/` with `core/`, `shared/`, `features/`, `models/`. Standalone components, signals, zoneless, SSR hybrid.
- `app.routes.ts` and `app.routes.server.ts` exist; render mode per route already declared (landing prerender, `:codigo` server, `app`/`admin`/`auth/login` client).
- Bootstrap already scaffolded: `features/auth/login/` (Login component), `features/pets/pets/`, `features/admin/admin/`, `features/public/{landing,rescue-page}/`, and `core/supabase/supabase.service.ts` (single anon-key client, SSR-aware persistSession=isBrowser), `core/error/global-error-handler.ts`, `src/environments/{environment,environment.development}.ts`.
- **Reconciliation note**: `docs/frontend.md` shows BOTH `core/auth/` (auth.store/auth.service/guards) and `features/auth/` (routes). The actual scaffold uses `features/auth/login/`. Plans should put auth UI under `src/app/features/auth/` and auth infra (store, service, guards, session-sync) under `src/app/core/auth/`. The supabase client is `core/supabase/supabase.service.ts` (NOT supabase-client.ts as the doc illustrates) — use the real filename.
- Backend: `supabase/` did NOT exist before spec 001 — login is the first feature to create `supabase/migrations/`, `supabase/functions/`, `supabase/config.toml`, `supabase/seed.sql`, `supabase/tests/` (pgTAP). Migration ordering convention is in `docs/backend-supabase.md` §8.1 (extensions → enums → core tables → ... → rls_policies → views → triggers), ALWAYS enabling RLS in the same migration that creates a PII table.

Feature names in English: `pets`, `health-records`, `subscription`, `reminders`, `admin`, `public`, `auth`.
Test id convention: `data-testid="<feature>-<elemento>"` (e.g. `login-email`, `login-submit`, `login-google`).

Tooling present in package.json: Angular 21, @supabase/supabase-js, PrimeNG 21 + @primeuix/themes, Vitest, Playwright, @angular/localize. Supabase CLI is NOT a node dependency — it is a separate binary (`supabase`) invoked from shell; quickstart must call it directly. `.mcp.json` exists (MCP Supabase for backend-supabase agent).
