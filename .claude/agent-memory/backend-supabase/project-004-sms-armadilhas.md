---
name: project-004-sms-armadilhas
description: Armadilhas da Phase 4 da spec 004 (SMS): deno test no CI, Kong e CORS no POST, driver log em duas linhas, now() em pgTAP, jsonb via PostgREST
metadata:
  type: project
---

Achados de 2026-11-22 (Phase 4, T041 a T053; detalhe em `specs/004-conta-tutor/execution-log.md`):

- `deno test` no CI falha com "Could not find @types/node" se um modulo testado importa **tipo** de `esm.sh` (o Deno do runner ve o `package.json` da raiz). Modulos testados usam tipos estruturais; so os `index.ts` importam supabase-js. Simular o CI: copiar `package.json` + `supabase/` para uma pasta sem `node_modules` e rodar `deno test`.
- O Kong local poe `Access-Control-Allow-Origin: *` tambem nas respostas de POST: a origem da funcao nunca e observavel localmente. Prove CORS pelos Allow-Headers/Allow-Methods exatos.
- `supabase functions serve` reinicia limpo com `kill` + novo `serve` (testado 6 vezes no CI); a funcao le o `.env` so na subida.
- O driver `log` escreve o SMS em duas linhas (o texto tem `\n`).
- pgTAP: `now()` e constante na transacao (ordem por `created_at`/`at` e ambigua; use contagem/array ordenado). `request.jwt.claims` fica de um `set_*` anterior mesmo apos `RESET ROLE`: funcoes que olham `auth.role()` (phone_is_confirmed) precisam do `set_service()` explicito. `SELECT` bare de funcao que devolve jsonb polui a saida TAP: use helper `void`.
- PostgREST devolve jsonb de coluna aninhada com `": "` (espaco); colunas de topo vem compactas.
- Heredoc/`node -e` com `\\` e aspas quebram no Bash tool: use Write/Edit.

**Why:** evitar redescobrir; limites do ambiente.
**How to apply:** antes de novos testes deno de funcoes, testes pgTAP com claims, ou checagens de CORS no script de CI.
