---
name: project-004-endurecimento-armadilhas
description: Armadilhas da Phase 10 (endurecimento) da spec 004: privilegios padrao e helpers de teste, pgTAP com has_sequence_privilege, handlers testaveis, deno.json/lock, CLI aceita auth.captcha
metadata:
  type: project
---

Achados de 2026-11-22 (T097 a T102; detalhe em `specs/004-conta-tutor/execution-log.md`):

- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ... FROM PUBLIC` vale em todo schema: helpers `tests.*` criados dentro dos testes pgTAP e chamados depois de trocar de papel precisam de `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO PUBLIC` (uma linha apos o `GRANT USAGE ON SCHEMA tests`). pgTAP vive em `extensions` (CI: dono `postgres`); a 0017 devolve o padrao antigo para `extensions`.
- pgTAP: `has_sequence_privilege(..., c.oid)` numa consulta sobre `pg_class` e avaliado em linhas que nao sao sequencia ("is not a sequence"): envolva em `CASE WHEN c.relkind = 'S'`.
- Orquestracao das Edge Functions fica em `handler.ts` (`createHandler(deps)`), `index.ts` so liga as dependencias reais; testes usam `_shared/testing.ts` (fakeRpc, fakeClock, postJson). Sono falso tem de resolver em macrotarefa (`setTimeout 0`) para promessas ja resolvidas ganharem `Promise.race`.
- `deno check supabase/functions/*/index.ts` valida os `index.ts` contra o `SupabaseClient` real sem rede de teste; use `--config supabase/functions/deno.json --lock=...` como o CI. O codigo importa `https://esm.sh/@supabase/supabase-js@2.108.1` direto (a CLI nao garante ler `deno.json` global); `deno.json` espelha a versao e `scripts/ci/edge-deps-check.sh` confere.
- CLI 3.2.0 aceita `[auth.captcha]` (enabled/provider/secret) e as chaves de rotacao/anonimo/manual-linking sem recusar. Registry do Docker as vezes devolve "Rate exceeded" no `supabase start` (retry interno resolveu).
- E-mail do coletor local: uma vez o link veio sem o modelo (3 FAIL no T004) e o mesmo codigo passou no run seguinte: flake do coletor, nao da 0017.
- `gh run view --log` conta na cota de 5.000/h compartilhada com o outro agente.

**Why:** evitar redescobrir. **How to apply:** novos testes pgTAP com helpers, novas Edge Functions, T104 (liga o captcha).
