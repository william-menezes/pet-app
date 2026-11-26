---
name: project-003-rodada-auditoria-contadores
description: Armadilhas de teste achadas na rodada de auditoria/contadores de PIN da spec 003 (gate vazio por \b, pgTAP via CLI, relogio fixo, grants de pets)
metadata:
  type: project
---

- **Gate vazio**: `check-pins-in-log.mjs` usava `\b` em template literal (retrocesso U+0008): nunca casava. Corrigido (DEF-003-04) com canario embutido. Toda varredura "nao aparece X" precisa de controle com X plantado. Heredoc do Bash tambem engole `\\`: escrever JS com Write.
- **pgTAP**: `psql` direto falha (`plan()` nao existe); rodar `npx --yes supabase@3.2.0 test db <arquivo.sql>` (aceita varios). Base suja de e2e quebra `seed_tags`, `rpc_admin` (lote-002) e `rls_perfis`: nao e defeito; `db reset` antes do `test db` completo.
- **Relogio fixo**: `now()` e fixo na transacao do teste; janelas de 15 min/24 h so se movem mexendo nas colunas; `audit_log.at = now()` isola o que o arquivo produziu.
- **pets**: `authenticated` so tem INSERT por coluna (sem `id`); inserir sem `id` e filtrar por tutor/nome. Release de tag gera PIN NOVO: nao reaproveitar o PIN do GUC nessa tag.
- **Pilha local**: `functions serve` com saida redirecionada para arquivo (senao o log some); `db reset` invalida o pool do e2e (`E2E_REUSE_POOL=0`). Config Playwright local sem `webServer` roda so os specs de API.
- `admin_hash_pins` com tipo errado: o cast do PostgREST (22P02) ecoa o valor; so service_role chega la (R-HASH-1).
- `gate-security.spec` chama RPCs com `{}` e aceita 404: prova possivelmente vazia para funcoes com argumento; use corpo no formato certo.
- Riscos abertos: R-AUD-1 (observacao livre do admin no `audit_log`), R-AUD-2 (leituras do admin nao auditadas), `labels_reprinted` so quando a T084 sair.
