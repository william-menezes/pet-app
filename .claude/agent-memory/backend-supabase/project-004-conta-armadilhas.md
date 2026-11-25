---
name: project-004-conta-armadilhas
description: Armadilhas do CI/Supabase CLI 3.2.0 e pendencias de decisao da spec 004 (seed sem instance_id, conflito com rls_perfis da 001, preflight do Kong, signup repetido 422)
metadata:
  type: project
---

Achados de 2026-11-22 (execucao BE/QA das Phases 1-2 da 004; detalhe em `specs/004-conta-tutor/execution-log.md`):

- RESOLVIDO em 2026-11-22: rls_perfis.test.sql da 001 foi atualizado ao contrato (anon 42501; admin sem papel) e o seed ganhou instance_id e identities. Signup repetido 422 foi aceito (ressalva no contrato).
- CLI 3.2.0: o coletor local e Mailpit (`/api/v1/search?query=to:...`, `/api/v1/message/<id>` em 54324). O Kong local responde o OPTIONS das funcoes com `Access-Control-Allow-Origin: *` antes da funcao; so se prova o CORS da funcao em resposta de POST.
- GoTrue v2.198 responde 422 `user_already_exists` ao signup repetido de e-mail confirmado (nao 200 ofuscado) e 429 ao repetido de nao confirmado (max_frequency 60s).
- `supabase start` no CI as vezes falha com "address already in use" na 54324 (flake de infra); `gh run rerun --failed` resolve. Rerun conta no orcamento de idas ao CI.
- `deno` local: `npm i deno` em pasta temporaria (scratchpad) funciona; rode `deno test --no-prompt` (sem permissoes, como o CI).
- Heredocs bash longos com aspas simples quebram o Bash tool; use a ferramenta Write para arquivos grandes.

**Why:** evitar redescobrir; sao decisoes/limites do ambiente, nao estao no codigo.
**How to apply:** antes de tarefas de Phase 3+ confirme se William resolveu o conflito da 001 e o seed.
