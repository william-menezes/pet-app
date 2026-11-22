# Contrato: expectativas de RLS e privilégios (004-conta-tutor)

**Princípio III.** Tabela nova nasce com RLS habilitada na mesma migration e sem política
permissiva. Função nova nasce com `REVOKE … FROM PUBLIC, anon, authenticated` e o `GRANT` exato.
Cada "nega" abaixo é um **teste negativo obrigatório**; se virar "permite", o merge é bloqueado.

Papéis de teste (do `supabase/seed.sql`): tutor A `…0001` (depois da tarefa T014: com aceite e
celular confirmado), tutor B `…0002` (sem aceite e sem celular), admin `…0003`.
Usar os helpers `tests.set_auth_uid`, `tests.set_anon` já existentes em `supabase/tests/`.
Cada teste roda dentro de `BEGIN … ROLLBACK` e **prepara o estado de que precisa** (como dono do
banco) em vez de depender de outro arquivo.

## Tabelas

| Tabela / operação | `anon` | tutor A (linha de A) | tutor A (linha de B) | admin | `service_role` |
|---|---|---|---|---|---|
| `perfis` SELECT | nega | permite | **nega** | permite | permite |
| `perfis` UPDATE `nome` | nega | permite | **nega** | permite | permite |
| `perfis` UPDATE `celular` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` UPDATE `celular_confirmado_em` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` UPDATE `celular_pendente` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` UPDATE `termos_aceitos_em`, `termos_versao` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` UPDATE `email` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` UPDATE `papel` | nega | **nega** | **nega** | **nega** | permite |
| `perfis` INSERT | nega | nega | nega | nega | permite |
| `perfis` DELETE | nega | nega | nega | nega | permite |
| `phone_verifications` SELECT / INSERT / UPDATE / DELETE | nega | nega | nega | nega | permite |
| `rate_limit_events` SELECT / INSERT / UPDATE / DELETE | nega | nega | nega | nega | permite |
| `auth_audit_log` SELECT | nega | nega | nega | permite | permite |
| `auth_audit_log` INSERT / UPDATE / DELETE | nega | nega | nega | nega | INSERT por função |

> "Nega" em `UPDATE` de coluna protegida significa erro `42501` (privilégio de coluna), não "zero
> linhas afetadas". O teste deve esperar o erro.

## Funções

| Função | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `log_auth_event` (da `001`) | **nega** | **nega** | permite |
| `record_login_attempt` (da `001`) | **nega** | **nega** | permite |
| `is_admin`, `current_user_role` (da `001`) | nega | permite | permite |
| `rate_limit_check` | nega | nega | permite |
| `phone_verification_begin`, `_send_failed`, `_active`, `_confirm` | nega | nega | permite |
| `phone_verification_status` | nega | permite | permite |
| `phone_is_confirmed` | nega | permite (só a própria conta devolve `true`) | permite |
| `accept_terms`, `log_logout`, `my_account` | nega | permite | — |
| `account_auth_facts` | nega | nega | permite |
| `export_my_data` | nega | permite | — |
| `delete_account_data` | nega | nega | permite |

Conferência por catálogo (além de chamar): `has_function_privilege('anon', '<assinatura>', 'EXECUTE')`
e `has_function_privilege('authenticated', …)` para **todas** as linhas acima.

## Arquivos de teste (pgTAP, `supabase/tests/`)

| Arquivo | Cobre |
|---|---|
| `funcoes_auth_grants.test.sql` | migration 0009 (funções da `001`) |
| `rls_perfis_conta.test.sql` | linhas de `perfis` desta matriz |
| `rate_limit_events.test.sql` | tabela e `rate_limit_check` |
| `phone_verifications.test.sql` | tabela, máquina de estados, `phone_is_confirmed` |
| `funcoes_conta.test.sql` | `handle_new_user`, `accept_terms`, `log_logout`, `my_account`, `account_auth_facts` |
| `auditoria_auth_users.test.sql` | gatilho em `auth.users` |
| `conta_privacidade.test.sql` | `export_my_data`, `delete_account_data` |

Os três arquivos da `001` (`rls_perfis.test.sql`, `rls_auth_audit.test.sql`, `rate_limit.test.sql`)
devem continuar verdes sem edição. Se algum quebrar por causa da 0009 ou da 0010, **parar e
relatar** em vez de alterar o teste antigo.

## Testes de segurança obrigatórios (lista do portão)

1. **Isolamento A↔B**: tutor A não lê nem altera `perfis` de B; `my_account`,
   `phone_verification_status` e `export_my_data` só devolvem dados de A.
2. **Anônimo não lê nada**: `SELECT` em `perfis`, `phone_verifications`, `rate_limit_events`,
   `auth_audit_log` ⇒ `42501`; nenhuma função desta spec é executável por `anon`.
3. **Não se autoconfirma**: o tutor B (sem celular) executa
   `UPDATE perfis SET celular = '+5511999999999', celular_confirmado_em = now() WHERE id = <B>` ⇒
   `42501`; `phone_is_confirmed(<B>)` continua `false`. O mesmo para `celular_pendente` e para
   `termos_aceitos_em`.
4. **Não escala papel**: `UPDATE perfis SET papel = 'admin'` ⇒ `42501`; cadastro com
   `papel`/`role` nos metadados nasce `tutor`.
5. **Códigos só como hash com chave**: `phone_verifications` não tem coluna de código nem de
   telefone em claro. Guardião de esquema: o conjunto de colunas é exatamente
   `id, user_id, phone_hash, code_hash, attempts, max_attempts, expires_at, consumed_at,
   invalidated_at, created_at`. Qualquer coluna a mais quebra o teste.
6. **Limites valem**: `rate_limit_check` nega no limite e não consome cota em negativa parcial;
   5 erros de código invalidam; teste de integração do `cooldown` e do limite por hora na Edge.
7. **Auditoria não forjável**: `anon` e `authenticated` não executam `log_auth_event`.
8. **Minimização**: nenhum `detalhe` de `auth_audit_log` criado pelos testes contém `@`, sequência
   de 8 ou mais dígitos, ou a palavra `hash`. Guardião de esquema de `auth_audit_log` da `001`
   continua verde.
9. **Exclusão falha fechada**: tabela de vínculos presente e operação ausente ⇒ nada excluído.
10. **Resgate primeiro (regressão)**: nenhuma migration desta spec cria política, `GRANT` ou
    gatilho em objeto de tags; o lint de fronteira continua impedindo `features/public` de importar
    `core/auth` e `core/account`.
