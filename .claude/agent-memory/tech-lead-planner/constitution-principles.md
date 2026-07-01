---
name: constitution-principles
description: Faro's 7 constitution principles (v1.1.0) and how feature plans typically satisfy each in the Constitution Check gate
metadata:
  type: project
---

Faro constitution lives at `.specify/memory/constitution.md` (v1.1.0). The Constitution Check is a mandatory gate in every plan.md. The 7 principles and the typical way a plan satisfies them:

- **I. Rescue-First (NON-NEGOTIABLE)**: public rescue route `/{codigo}` + WhatsApp work regardless of subscription status. Freemium floor = Grátis tier (always at least in-app scan alert); alert routing to Admin is a safety net. Public rescue projection (`perfil_resgate_publico`) NEVER joins `assinaturas`. **For any feature, explicitly confirm it introduces no auth/subscription dependency on the public rescue path.**
- **II. Privacy & LGPD by design (NON-NEGOTIABLE)**: only expose consented fields; data minimization; geo consented + labeled; titular can export/delete; consent auditable. Audit tables must avoid PII beyond the strict minimum.
- **III. Security-in-depth & RLS-first (NON-NEGOTIABLE)**: every PII table is born with RLS enabled + deny-by-default in the SAME migration. anon reaches data ONLY via whitelisted view/RPC. Opaque tag codes. Secrets (service_role, payment/geo/SMTP keys) ONLY in Edge Functions, never client/SSR.
- **IV. Spec-Driven Development**: spec (WHAT/WHY, stack-agnostic) → plan → tasks. Constitution beats ad-hoc.
- **V. Mobile-first, performance & universal access**: PWA; public routes SSR/prerender; WCAG 2.1 AA; i18n-ready (PT-BR MVP); perf budget on rescue page.
- **VI. Simplicity & incremental delivery (MVP-first/YAGNI)**: each user story is independently shippable/testable (P1/P2/P3). Complexity needs justification in Complexity Tracking. Marketplace = Phase 2.
- **VII. Observability, auditability & reliability**: sensitive events logged in structured/auditable form (`auditoria` table append-only + `scan_events`). Friendly errors + fallback. Payment failures follow grace ruler, never cut rescue.

Quality gate from constitution: security & privacy review is MANDATORY for any feature touching PII, RLS, payment, or public exposure. Every schema change goes through a reviewed migration.
