---
name: project-structure
description: Key paths in the Faro Angular frontend — where things live after bootstrap + 001-login
metadata:
  type: project
---

Core auth infra lives in `src/app/core/auth/`: AuthStore (signals), AuthService, guards (authGuard/adminGuard/anonGuard), role-redirect.ts, session-persistence.ts.

Supabase client singleton: `src/app/core/supabase/supabase.service.ts` — anon-key only, SSR-aware (isBrowser guard).

Feature auth UI in `src/app/features/auth/`: login/ (login.ts, login.html, login.css) and callback/ (oauth-callback.ts).

Shared reusable components in `src/app/shared/ui/`: faro-field/ (label+control+error wrapper, born in 001-login).

Styles: `src/styles/faro-ds.css` (CSS tokens — `--primary`, `--danger`, `--warn`, `--info`, `--success`, `--app`, `--surface-0`, `--border`, `--r-sm/md/lg`, `--tap`, `--shadow-card`). All components use these CSS vars directly.

Render modes in `src/app/app.routes.server.ts`: Prerender (landing), Server (/:codigo, /:codigo/perdido), Client (all auth/app/admin routes).

Routes defined in `src/app/app.routes.ts` — auth routes nested under `path: 'auth'` with `canMatch: [anonGuard]`.

Angular config: `src/app/app.config.ts` — provideZonelessChangeDetection, FaroPreset/Aura theme, SSR hydration.

Theme: `src/theme/faro-preset.ts` — FaroPreset extending Aura. CSS layer named 'primeng' so faro-ds.css (unlayered) wins on conflict.

**Why:** [[auth-patterns]]
