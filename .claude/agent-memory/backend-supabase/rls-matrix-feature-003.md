---
name: rls-matrix-feature-003
description: Matriz final de RLS/EXECUTE da spec 003 (tag QR) e os contratos de RPC e Edge Function expostos ao frontend; armadilhas das Phases 8 a 12
metadata:
  type: project
---

Estado final do backend da 003 (migrations 0020 a 0035; ultimo CI verde: run 45525406840, 2026-11-25; pgTAP 27 arquivos/1377 asserções, deno 330, script de CI 259 PASS).

**Acesso por objeto** (anon nunca tem nada; toda tabela nasce com RLS e `REVOKE ALL ... FROM PUBLIC, anon, authenticated`):
- `pets`, `rescue_profiles`: tutor so os dele (colunas `show_*`/`lost_show_*` atualizaveis; `lost_mode`/`lost_since` so por RPC); admin le. Gatilhos: `pet_limit` (20), `pet_has_active_tag`.
- `tag_codes`, `tag_batches`, `tag_pin_attempts`, `pending_activations`, `rate_limits`, `audit_log`: sem acesso direto de `authenticated`; admin le so por RPC `admin_*` (nunca `activation_pin_hash`); `service_role` com GRANT explicito (audit_log so SELECT/INSERT).
- `tag_assignments`, `tag_replacement_requests`: tutor le os dele. `scan_events`: so colunas sem `ip_hash`/token/`notified_at`; o app le `my_scans` (security_invoker).
- Storage `pet-photos`: politicas por prefixo `<uid>/`; 5 MB; jpeg/png/webp.
- EXECUTE `authenticated`: `check_tag_for_link`, `activate_tag`, `set/get/clear_pending_activation`, `set_lost_mode`, `my_dashboard`, `release_tag`, `request_tag_replacement`, `admin_*` (menos `admin_insert_batch` e `admin_mark_package_downloaded`). So `service_role`: `resolve_tag`, `register_scan`, `set_scan_location`, `scan_notice_*`, `admin_insert_batch`, `admin_mark_package_downloaded`, `global_rate_hit`, `admin_rate_hit`, `end_assignments_for_account`, `export_tutor_tag_data`, `rate_limit_hit`. Internas sem grant: `rpc_guard`, `rate_hit_audited`, `tag_err`.

**Contratos**: formas de resposta de cada RPC/Edge Function estao em `specs/003-tag-qr/execution-log.md` (secoes "Formas de resposta"). Erro de negocio e retorno `{ok:false,error}`; excecao so para erro de programacao e gatilhos de tabela.

**Armadilhas (Phases 8-12)**:
- `count(...) FILTER` dentro de `jsonb_agg(jsonb_build_object(...))` na mesma consulta: "aggregate function calls cannot be nested". Agrupe em subconsulta e agregue por fora.
- `plpgsql` resolve nomes na chamada: 0031 chama `rpc_guard` criada so na 0035, sem problema.
- Script de CI (`scripts/ci/supabase-checks.sh`): admin do seed `admin@faro.test`/`TesteSenha123!`; `unzip` existe no runner; o lote criado pelo teste do gateway vira `lote-002`/`lote-003` no banco do CI (codigo nunca e apagado, entao o que roda depois nao pode assumir lotes vazios).
- Pendencias: foto com `<tutor_id>/<pet_id>` na URL assinada (duas saidas no log); bcrypt custo 12 x 500 codigos numa transacao nao medido (~100 s); T084/T085 bloqueadas (fonte e mascaras do lote-001); `admin-labels` precisa chamar `requireAdmin` quando existir; Vault precisa de `faro_functions_url`/`faro_ssr_key` para o reenvio em producao.

**Why:** evitar redescobrir. **How to apply:** merge/revisao da 003, T084 e qualquer mudanca em RPC de tag.
