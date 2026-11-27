---
name: project-003-fases3a6-armadilhas
description: Armadilhas das Phases 3 a 6 da spec 003 (resolve_tag, activate_tag, scans, set_lost_mode): pgTAP, edicao de arquivos, ambiente CI, decisoes do William
metadata:
  type: project
---

Achados de 2026-11-22/24 (detalhe em `specs/003-tag-qr/execution-log.md`, worktree `scratchpad/wt-003`):

- `node -e` com `String.replace` e texto contendo `$$` vira `$` (quebrou `AS $$ ... $$` no teste). Edite SQL/sh com Edit/Write; heredoc com aspas e acentos longos tambem falhou no Bash tool: escreva o texto com Write e `cat >>`.
- pgTAP: `ROLLBACK TO savepoint` desfaz o registro dos testes; para trocar `can_link_tag` por false, use `CREATE OR REPLACE` e restaure. CTE com UPDATE/DELETE dentro de subconsulta nao vale: helper plpgsql com `GET DIAGNOSTICS ROW_COUNT`. `check_tag_for_link` conta 10 chamadas por conta por transacao: cuidado com asserts que chamam varias vezes. PIN de teste: GUC `tests.pin` (is_local) com `new_activation_pin()`.
- Seed: tutor A se chama "Tutor A Teste" (primeiro nome "Tutor"), celular +5511900000001. `seed.sql` nao se edita; `make-seed.ts` regenera o trecho (Node 24 roda .ts local).
- Verificado no CI (CLI 3.2.0): migrations com `storage.buckets` + politicas em `storage.objects`, `CREATE EXTENSION pg_cron/pg_net` e `cron.schedule` aplicam; gateway local aceita `resolve-tag` so com `x-faro-ssr-key` (verify_jwt=false).
- Deno local: `scratchpad/deno/node_modules/@deno/win32-x64/deno.exe`; simular CI copiando package.json, supabase/ e `src/app/core/tag-code/{tag-code.ts,fixtures}` para `scratchpad/ci-sim3`.
- Decisoes: PINs de desenvolvimento fixos so nas 3 tags available do lote-900 (William, 2026-11-22). Pendencias: `photo_path` expoe tutor_id/pet_id na URL assinada; Vault precisa de `faro_functions_url` e `faro_ssr_key` para o reenvio em producao; T058 usa liberacao simulada ate T087.

**Why:** evitar redescobrir. **How to apply:** Phase 7+ da 003 (release_tag, my_dashboard, admin_*), Phase 12 (rpc_guard, limites do bucket: o script de CI sobe .txt em pet-photos e quebra com limite de mime).
