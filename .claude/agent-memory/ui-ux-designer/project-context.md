---
name: project-context
description: Contexto do produto Faro — SaaS pet, stack, renderização, estrutura de rotas
metadata:
  type: project
---

# Contexto do Projeto Faro

## Produto
- SaaS de cuidado, saúde e resgate de pets via QR Code
- Freemium: Grátis / Pro / Família
- Público: tutores de cães e gatos no Brasil (PT-BR)
- Diferencial: página de resgate funciona SEMPRE, mesmo com assinatura inativa (Rescue-First)

## Stack
- Frontend: Angular 21, standalone components, signals, zoneless
- UI: PrimeNG tema Aura + FaroPreset + PrimeIcons
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
- Renderização híbrida: SSR nas rotas públicas, CSR no painel

## Estrutura de rotas
- `/` — landing (prerender)
- `/{codigo}` — página pública de resgate (SSR por requisição) — ativo de marca nº1
- `/auth/**` — login/cadastro/reset (CSR, `anon.guard` redireciona logados)
- `/app/**` — painel do tutor (CSR, `auth.guard`)
- `/admin/**` — backoffice (CSR, `admin.guard`)

## Auth (Supabase Auth)
- Rotas de auth em `/auth/**`, CSR puro
- `anon.guard` (CanMatch) — redireciona logado para `/app`
- `auth.guard` (CanMatch) — redireciona não-logado para `/auth/login`
- Features: login, signup, forgot-password, reset-password

## Convenções de data-testid
- Padrão: `<feature>-<elemento>[-<variante>]`
- Exemplos existentes: `rescue-whatsapp-cta`, `pet-form-submit`, `subscription-grace-banner`

**Why:** Bootstrap executado em 2026-06-10; app Angular 21 com SSR híbrido, PrimeNG, Vitest, Playwright.
**How to apply:** Telas de auth são CSR (não SSR); usar FaroPreset, faro-ds.css tokens, sem código Angular (só blueprint).
