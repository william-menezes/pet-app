---
name: locked-decisions
description: Faro decisions locked in docs/README.md — do NOT reopen these in plans; materialize them
metadata:
  type: project
---

`docs/README.md` is the SINGLE SOURCE of decisions. Locked (do NOT reopen — just materialize):

- **Palette C "Faro Noturno"**: primary Indigo `#3A4FD6`, accent Lime `#7FBF3F`. Lost-mode band = amber (`--faro-lost-band`), never primary nor danger.
- **Typography**: Poppins (titles) + Inter (text), self-hosted, subset latin+latin-ext.
- **SSR hosting** = Vercel. **Supabase region** = São Paulo (BR).
- **Admin role** = `is_admin()` SQL function reading `perfis.papel = 'admin'` (NO custom JWT claim in MVP — YAGNI). Custom-claim Auth Hook is documented as future evolution if RLS-admin cost shows in profiling.
- **Public view** = RPC `SECURITY DEFINER` (hardened projection), not raw GRANT SELECT, for prod.
- **Map** = Leaflet + OpenStreetMap (no client key).
- **Test runner** = Vitest. Integration RLS tests = pgTAP (`supabase test db`). E2E = Playwright.
- **Boundaries enforcement** = eslint `no-restricted-imports` (keeps `features/public` from importing the panel / core/auth / core/billing).
- **`registros_saude.dados`** = `jsonb`. **Reminders cron** = `pg_cron`.
- **Public page theme** = light fixed (panel dark mode = later phase).
- **CI coverage** = 80% global / 90% in `core/` and policies.
- **Billing** = Freemium hybrid (Grátis/Pro/Família); provider (Stripe vs Asaas) still OPEN — agnostic billing port. Tiers: Grátis 1 pet, Pro ~R$19,90 3 pets, Família ~R$34,90 10 pets, 14-day trial.

Open decisions tracked in docs/README.md "Decisões em aberto" table, each resolved in a specific spec (e.g. rate-limit params + check-digit algorithm → spec 005; geo-IP provider → 006; email provider → 007; LGPD retention → 009).

Supabase backend data model (tables, RLS matrix, RPCs like `is_admin()`, `pode_acessar_pet()`, `claim_tag`, view `perfil_resgate_publico`, trigger `handle_new_user`) is fully designed in `docs/backend-supabase.md`. Auth design (email/password with confirmation, Google OAuth, profile-provisioning trigger) is in §4.
