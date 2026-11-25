---
name: project-004-privacidade-armadilhas
description: Armadilhas das Phases 6 e 7 da spec 004 (pgTAP com SAVEPOINT, recuperacao de senha, exclusao de conta, script de CI)
metadata:
  type: project
---

Achados de 2026-11-22 (T066, T067, T073 a T077; detalhe no execution-log):

- pgTAP: `ROLLBACK TO` por caso (exigido pela T075) esvazia a tabela de resultados; `finish()` lanca "# No tests run!" (exit 3) mesmo com "All N subtests passed". Termine o arquivo em `ROLLBACK` sem `finish()`; o pg_prove confere plano e cada ok/not ok.
- pgTAP: para guardar o resultado de uma RPC que usa `auth.uid()`, chame como dono do banco com so as claims (`set_config('request.jwt.claims', ...)` sem trocar o role) e grave em tabela TEMP; troque de role de verdade so para os testes de privilegio.
- `verify_jwt = true` aceita a chave anonima (ela e um JWT); a recuperacao de senha (visitante) usa isso.
- Mailpit local: contar mensagens de um destinatario = contar `"ID":"` em `/api/v1/search?query=to:<email>`.
- Limite de login do GoTrue local (`sign_in_sign_ups = 30` por 5 min por IP) conta os `signInWithPassword` do script de CI; para provar `rate_limited` da reautenticacao, grave os 5 eventos direto em `rate_limit_events` (service_role via REST) em vez de errar a senha 5 vezes.
- Outro agente edita `tasks.md` na mesma pasta e commita junto: depois de marcar `[x]`, confira com `git log -- tasks.md` se a marca ja foi num commit dele. `.git/index.lock` pode aparecer por causa dele: repita o commit.

**Why:** evitar redescobrir. **How to apply:** novos testes pgTAP com SAVEPOINT, novas checagens no supabase-checks.sh, Phase 10 (limites novos, captcha).
