---
name: project-003-fundacao-armadilhas
description: Armadilhas e decisoes da fundacao da spec 003 (tag QR): privilegios de tabela nova, seed sem PIN, testes pgTAP com seed presente, edicao por node -e, worktree wt-003
metadata:
  type: project
---

Achados de 2026-11-22 (T001..T023 da 003, worktree `scratchpad/wt-003`, branch `003-tag-qr`; detalhe em `specs/003-tag-qr/execution-log.md`):

- Depois da 0017, tabela nova em `public` nasce SEM `anon` mas COM todos os privilegios padrao de `authenticated`/`service_role`. Toda migration: `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, GRANT de coluna, e `GRANT` explicito para `service_role` (em `audit_log` so SELECT/INSERT).
- pgcrypto vive em `extensions`: use `extensions.crypt/gen_salt/gen_random_bytes` em funcoes com `search_path = public, pg_temp`.
- O seed da 003 existe no CI: testes pgTAP NAO podem usar os codigos do seed (7K3MQ9XAC e os 5 gerados) nem contar linhas globais de `tag_codes`/`pets`; usam vetores sinteticos de `tag-code.vectors.json` (ex.: ABCDEFGHV, ZZZZZZZZ8) e filtram por lote/tutor do proprio teste.
- Seed NAO tem PIN conhecido (decisao: repo publico). Testes geram PIN com `new_activation_pin()` dentro da transacao; e2e pede PIN novo ao admin (`admin_reissue_pin`). Lote do seed e `lote-900` (CHECK `^lote-[0-9]{3,}$` mantido).
- `scan_events`: `SELECT *` falha para authenticated e admin (colunas sensiveis); o app le `my_scans` (security_invoker).
- `supabase_migrations.schema_migrations.statements` existe no CI do CLI 3.2.0 e guarda o texto das migrations (usado em `conta_estado_inicial.test.sql`).
- Bash tool: `node -e` com `$$` ou `\$` corrompe SQL (virou `DO $` e `$;`); edite arquivos SQL com Edit/Write e confira com `git show HEAD:arquivo | cat -A`. Contagem do plan: `grep -cE "^SELECT (is|ok|is_empty|isnt|lives_ok|throws_ok)\("`.
- Windows com autocrlf: arquivos de trabalho saem LF e o git avisa CRLF; o teste de sincronia do tag-code compara blobs iguais (ok no CI, Linux).
- `deno` local: `npm i deno` no scratchpad; simule o CI copiando package.json + supabase/ + `src/app/core/tag-code/fixtures` para uma pasta sem node_modules (o teste deno importa o JSON dos vetores por import attribute).
- `gh run view --log` roda em worktree (precisa estar dentro do repo); cota de 5000/h compartilhada com o outro agente.

**Why:** evitar redescobrir. **How to apply:** Phase 3+ da 003 (resolve_tag, activate_tag, admin_*): GRANT explicito, nada de PIN em arquivo, testes isolados do seed.
