---
name: project-structure
description: Onde as coisas moram no frontend do Faro depois da spec 002 (ZardUI + Tailwind v4)
metadata:
  type: project
---

- Tema: **um arquivo só**, `src/styles.css` (Tailwind v4 + variáveis do Faro, claro e escuro). Sem cor solta em `src/app/` (o `check:ui` reprova).
- `src/app/core/`: `auth/` (AuthStore, guards, role-redirect), `supabase/` (cliente só com anon key, SSR-aware), `theme/` (ThemeService, preferência em `faro.theme`), `pwa/` (limpeza do service worker antigo).
- `src/app/shared/components/<nome>/`: componentes do ZardUI copiados e editados (`z-button` etc.); `shared/components/faro/`: componentes próprios (logo, focinho, brand-panel, action-card...). `shared/core/` e `shared/utils/` são base do ZardUI. `shared/shells/`: cascas tutor, admin, fluxo e layout público. `shared/icons/faro-icons.ts`: Boxicons sob nomes do Faro.
- `src/app/features/`: `auth/` (login, callback), `public/` (landing, rescue-page; SSR), `pets/`, `admin/`, `dev-gallery/` (`/dev/ui`, só em dev).
- Rotas: `app.routes.ts`; modo de renderização em `app.routes.server.ts` (Prerender na landing, Server no `:codigo`, Client no resto).
- `scripts/ui-checks/`: `tokens`, `removed-stack`, `boundary`, `public-bundle`; `npm run check:ui` roda os três primeiros.
- Fronteira: `features/public/` não importa `auth`, `pets`, `admin`, `core/auth`, `core/theme`, overlays; o ESLint barra.

**Why:** estrutura criada pela spec 002; o desenho anterior (PrimeNG, `src/styles/`, `src/theme/`) não existe mais.
**How to apply:** ao criar tela nova, parta de `shared/shells/` e de `shared/components/faro/`; peça componente novo ao ZardUI com `npx zard-cli@1.12.0 add <nome> --yes` e leia [[zardui-pitfalls]].
