---
name: project-004-chave-publica-verify-jwt
description: chave publishable nova, verify_jwt por funcao e resolvedor de chave publica nas Edge Functions da 004 (decisao de 2026-11-25)
metadata:
  type: project
---

- Docs do Supabase (auth-headers, lidas 2026-11-25): o portao verify_jwt AINDA aceita `sb_publishable_...` no Authorization "por compatibilidade de migracao" (transitorio); a premissa do 401 nao se confirmou. Localmente a CLI 3.2.0 tambem deixou passar.
- Decisao: `verify_jwt=false` so em login-guard e password-recovery (pre-sessao); as 3 de sessao seguem true.
- `env.ts` resolve a chave publica: SUPABASE_PUBLISHABLE_KEYS (JSON default) > SUPABASE_PUBLISHABLE_KEY > SUPABASE_ANON_KEY. Hospedado injeta tambem SUPABASE_SECRET_KEYS; SERVICE_ROLE e ANON sao "legadas" mas ainda injetadas.
- `getCaller` decide pela forma do JWT (`_shared/caller.ts`, sem import do supabase-js, testavel sem rede).
- Armadilha: `node -e` com regex em heredoc perde as barras invertidas; para editar arquivo use a ferramenta Edit.
- Armadilha: o `supabase start` local expoe PUBLISHABLE_KEY real (sb_publishable_...); da para testar chamadas sem JWT localmente.

**Why:** login pre-sessao nao pode depender de compatibilidade transitoria. **How to apply:** novas funcoes pre-sessao nascem com verify_jwt=false e codigo como barreira.
