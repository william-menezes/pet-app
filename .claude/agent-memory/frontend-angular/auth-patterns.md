---
name: auth-patterns
description: Patterns established in 001-login for auth, security and anti-enumeration in Faro
metadata:
  type: project
---

**Anti-enumeration (FR-014/019, SC-004):** AuthService._classifyError() maps ALL GoTrue errors (invalid credentials AND user not found) to `reason: 'invalid'` with the same PT-BR message. Never branch on GoTrue error codes in the UI. Timing is uniform because both cases go through the same code path (no early-return before rate-limit).

**Rate-limit gate (FR-018):** signInPassword() calls Edge Function `login-guard` with `{phase:'pre_attempt', email}` BEFORE calling signInWithPassword. On `block` or `backoff`, returns `rate_limited` without calling GoTrue at all.

**Role resolution (FR-005/006):** After successful signIn, calls `supabase.client.rpc('current_user_role')`. The result populates AuthStore.role() — used only for UI routing. Real authorization is RLS `is_admin()` in the DB.

**"Manter conectado" (FR-007/008/009):** setRememberMe(boolean) selects localStorage (true) or sessionStorage (false) and sets it on the Supabase client auth storage before signIn. Lives entirely in core/auth/session-persistence.ts — never touched by features.

**Token isolation (T020d):** localStorage/sessionStorage access is banned from features/ and shared/ via ESLint `no-restricted-globals`. Only core/ may access them.

**Guards are CanMatchFn (not CanActivateFn).** This prevents lazy chunk download for unauthorized routes. authGuard for /app, adminGuard for /admin, anonGuard for /auth. All in separate files under core/auth/.

**anonGuard wraps the entire /auth parent route** (not individual child routes). This means a single guard protects all auth/* routes, and logged-in users are redirected immediately without seeing the login form (FR-011).

**AuthStore is the single source of truth for auth state.** Components never inject SupabaseService directly. AuthService mutates the store; components read the store's readonly signals.

**CSP (T020a):** Defined in vercel.json (production) and src/server.ts (SSR dev). script-src is 'self' only — no unsafe-inline, no unsafe-eval. connect-src allows *.supabase.co.
