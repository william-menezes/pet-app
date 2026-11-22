# Contrato: RLS e gate de segurança

Este arquivo é o gabarito do `qa-engineer`. Cada linha vira pelo menos um teste pgTAP em
`supabase/tests/`. **Qualquer falha aqui bloqueia o merge.**

Papéis de teste: `anon`; `tutor_a` (Ana: Paçoca com a tag `T1`; Mel sem tag); `tutor_b` (um pet com
a tag `T2`); `admin`.

## Regras gerais

- Toda tabela desta spec tem RLS habilitada (`relrowsecurity = true`) e **nenhuma** política para `anon`.
- `anon` não tem `EXECUTE` em nenhuma função desta spec.
- `authenticated` não tem `SELECT` em `tag_codes.activation_pin_hash`, `scan_events.ip_hash` nem
  `scan_events.location_token_hash`.
- Nenhuma função `security definer` fica sem `SET search_path`.

## Matriz

| Objeto | anon | tutor_a | tutor_b | admin |
|---|---|---|---|---|
| `pets` de A | nega | lê e altera | **nega** | lê |
| `rescue_profiles` de A | nega | lê; altera só `show_*` e `lost_show_*` | **nega** | lê |
| `tag_codes` (direto) | nega | **nega** | nega | lê por RPC/view sem hash |
| `tag_batches` | nega | nega | nega | lê |
| `tag_assignments` de A | nega | lê | **nega** | lê |
| `tag_pin_attempts` | nega | nega | nega | lê |
| `pending_activations` | nega | só por RPC, a própria | nega | nega |
| `rate_limits` | nega | nega | nega | nega |
| `scan_events` do vínculo de A | nega | lê por `my_scans` | **nega** | lê sem `ip_hash` |
| `tag_replacement_requests` de A | nega | lê | nega | lê |
| `audit_log` | nega | nega | nega | lê por RPC |
| `storage: pet-photos/<A>/…` | nega | lê e grava | **nega** | nega |
| `resolve_tag`, `register_scan`, `set_scan_location`, `admin_insert_batch`, `end_assignments_for_account`, `export_tutor_tag_data` | nega | **nega** | nega | **nega** (só `service_role`) |
| RPCs `admin_*` | nega | `forbidden` | `forbidden` | permite |

## Testes de isolamento entre vínculos (LGPD)

1. A libera `T1` e B a ativa com o PIN novo. **B não lê** nenhum scan anterior de `T1`.
2. Depois da troca, um scan novo de `T1`: **A não lê**.
3. O histórico de vínculos de `T1` só é visível ao admin.
4. `end_assignments_for_account(A)`: vínculos encerrados com `account_deleted`; scans sem
   coordenadas; códigos continuam existindo; segunda chamada devolve 0; **`activation_pin_hash`
   de cada tag é o mesmo de antes** e outra conta ativa a tag com o PIN original.
5. `export_tutor_tag_data(A)` não contém dado do tutor B, `ip_hash`, token nem hash de PIN.

## Testes do contrato físico

1. `UPDATE tag_codes SET code = …` falha para qualquer role de aplicação.
2. `DELETE FROM tag_codes` falha para qualquer role de aplicação.
3. Sair de `void` falha.
4. `INSERT` de código com dígito verificador inválido falha (`CHECK`).
5. Segundo vínculo ativo para a mesma tag, ou para o mesmo pet, falha (índices únicos parciais).

## Testes de Rescue-First

1. `resolve_tag` devolve a projeção com `can_link_tag` devolvendo `false` (simulado): o limite não
   afeta tag já vinculada.
2. Teste estrutural: o corpo de `resolve_tag` e de `register_scan` não contém nenhuma referência a
   objetos de cobrança (`plan`, `subscription`, `assinatura`, `entitlement`).
3. Tag bloqueada: `resolve_tag` devolve `not_found` e o scan vai para a fila do admin.

## Testes de anti-enumeração

1. Inexistente, bloqueado e anulado: saída idêntica de `resolve_tag`.
2. Dígito verificador inválido: nenhuma leitura em `tag_codes` (verificar pela ausência de
   alteração no contador de limite e por `pg_stat_statements` ou por função de teste).
3. Limite por `ip_hash`: a 31ª chamada em um minuto devolve `rate_limited`.
4. `check_tag_for_link`: mesma mensagem para `assigned`, `blocked`, `void` e inexistente.

## Gate não relacionado a banco (executado pelo `qa-engineer`)

- Busca por segredos no build (`dist/`): `service_role`, `FARO_SSR_KEY`, `IP_HASH_SECRET`,
  credenciais de e-mail. Zero ocorrências.
- O bundle da rota pública não contém os chunks de `features/activation`, `pets`, `scans`, `admin`.
- axe sem violações AA nas telas desta spec, nas três larguras.
- Orçamento da rota pública: LCP ≤ 2,5 s, TTFB ≤ 600 ms, JS ≤ 100 KB gzip.
- Depois: gate humano com `/security-review` e `/code-review`.
