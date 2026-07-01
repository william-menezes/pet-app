---
name: planning-patterns
description: Task-structure patterns and recurring NEEDS CLARIFICATION sources for Faro plans
metadata:
  type: feedback
---

Patterns that fit the Faro tasks-template and templates:

- **Phases**: Setup → Foundational (BLOCKS all stories) → US1 (P1) → US2 (P2) → US3 (P3) → Polish. Foundational holds shared infra (migrations base, RLS deny-by-default, is_admin(), session/auth core service) that every story needs.
- **Backend before the frontend that consumes it**: migrations/RLS/Edge/RPCs first, then Angular tasks that call them. Within a story, backend and frontend are SEPARATE tasks and run in PARALLEL [P] once the contract (in `contracts/`) exists — the contract is the synchronization point.
- **[P] marker** = different files, no dependency. Backend SQL task and frontend component task in the same story are usually [P] after contracts are written. Tasks touching the SAME file are never [P].
- **Tests**: docs/test-strategy.md defines mandatory classes per principle. For security-touching features include: pgTAP RLS isolation (positive+negative), anon-denied, secret-scan-in-bundle, and the Rescue-First anti-regression guard. Use data-testid selectors in E2E.

Recurring NEEDS CLARIFICATION / gate-risk sources to anticipate:
- Rate-limit exact params + check-digit algorithm (README says spec 005, but a login feature needs its own login rate-limit numbers — spec 001 clarify fixed 5 fails/15min by identity+IP).
- Geo-IP provider (spec 006), email/transactional provider (spec 007) — affects Edge Function secrets and Auth email templates (confirmation/reset). For login: the confirmation-email RESEND path depends on the email provider being configured; mark as dependency on signup/007, not a blocker for login itself.
- LGPD retention window for audit/scan/ip_hash (spec 009) — for any new audit table, note retention is deferred to 009 but design the column set minimally now.
- Billing provider (Stripe vs Asaas) — never blocks; isolated by billing port.

Rescue-First gate is the easiest to satisfy AND the most important to state explicitly: confirm the feature does not touch `features/public/**`, does not add auth to `/{codigo}`, and the public projection still has no `assinaturas` join.
