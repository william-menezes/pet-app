# Contrato: Edge Function `account-delete` + `delete_account_data`

`POST /functions/v1/account-delete` — `supabase/functions/account-delete/index.ts`
`public.delete_account_data(uuid, text, text)` — migration 0016

Exclui a conta do próprio titular (LGPD, Princípio II) sem quebrar o Princípio VIII: **nenhum
código de tag é apagado ou alterado**. Os vínculos são encerrados pela operação da `003`.

Convenção de resposta, módulos e variáveis: `shared-edge.contract.md`.
Dependência entre specs: `cross-spec-003.contract.md`.

## Quem pode chamar

Conta autenticada, sobre **a própria conta**. O id vem do token, nunca do corpo.

## Entrada

```json
{ "confirm": "EXCLUIR", "password": "…" }
```

| Campo | Regra |
|---|---|
| `confirm` | exatamente `"EXCLUIR"` |
| `password` | obrigatório para conta com senha; ignorado para conta só com o Google |

## Saídas (HTTP 200)

| Corpo | Quando | Texto ao tutor |
|---|---|---|
| `{ "ok": true }` | conta excluída | "Sua conta foi excluída." |
| `{ "ok": false, "error": "confirmation_required" }` | `confirm` diferente de `EXCLUIR` | "Digite EXCLUIR para confirmar." |
| `{ "ok": false, "error": "reauth_required", "method": "password" \| "google" }` | falta a prova de identidade | "Confirme que é você para excluir a conta." |
| `{ "ok": false, "error": "invalid_password" }` | senha errada | "Senha incorreta." |
| `{ "ok": false, "error": "rate_limited", "retry_after_seconds": n }` | 5 erros em 15 min | "Muitas tentativas. Tente de novo em {tempo}." |
| `{ "ok": false, "error": "deletion_unavailable" }` | a etapa de dados falhou; **nada foi excluído** | "Não foi possível excluir sua conta agora. Nada foi apagado. Tente mais tarde." |
| `{ "ok": false, "error": "deletion_incomplete" }` | dados e vínculos já encerrados, mas fotos ou o usuário não foram removidos | "A exclusão não terminou. Toque em excluir de novo para concluir." |

## Passos (a ordem é parte do contrato)

1. `handleOptions`; só `POST`. `loadEnv({})`.
2. `getCaller` ⇒ `401` se nulo. Corpo ⇒ `400` se não for objeto JSON.
3. `confirm !== 'EXCLUIR'` ⇒ `confirmation_required`.
4. `facts = rpc('account_auth_facts')`.
5. `requireRecentAuth({ action: 'excluir_conta', … })`. Falha ⇒ o erro dele.
6. **Dados e vínculos**: `rpc('delete_account_data', { p_user_id, p_ip_hash, p_user_agent })`.
   Qualquer erro ⇒ registrar em log (sem dados pessoais) e responder `deletion_unavailable`.
   **Parar aqui.**
7. **Fotos**: se o bucket `pet-photos` existir, listar e remover tudo sob o prefixo `<uid>/`
   (em lotes de até 100). Bucket inexistente ⇒ seguir. Erro ao listar ou remover ⇒
   `deletion_incomplete`. **Parar aqui.**
8. **Usuário**: `auth.admin.deleteUser(uid)`. Erro ⇒ `deletion_incomplete`.
9. Responder `{ "ok": true }`.

Depois do sucesso, o frontend chama `signOut({ scope: 'local' })`, limpa os stores e navega para
`/auth?conta=excluida`.

### Por que esta ordem

Dados e vínculos primeiro, usuário por último: se algo falhar no meio, ainda existe uma conta que
consegue entrar e **repetir** o pedido. Todos os passos são idempotentes. A ordem inversa deixaria
vínculos e fotos sem dono e sem ninguém para pedir de novo.

## `delete_account_data(p_user_id uuid, p_ip_hash text, p_user_agent text) returns jsonb`

`SECURITY DEFINER`, `SET search_path = public, pg_temp`. `EXECUTE`: só `service_role`.

```text
v_ended := NULL; v_hook := 'absent';

IF to_regprocedure('public.end_assignments_for_account(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.end_assignments_for_account($1)' INTO v_ended USING p_user_id;
    v_hook := 'called';
ELSIF to_regclass('public.tag_assignments') IS NOT NULL THEN
    RAISE EXCEPTION 'deletion_hook_missing';        -- falha fechada
END IF;

DELETE FROM phone_verifications WHERE user_id = p_user_id;
DELETE FROM rate_limit_events  WHERE key = p_user_id::text;

IF NOT EXISTS (SELECT 1 FROM auth_audit_log WHERE ator = p_user_id AND evento = 'conta_excluida') THEN
    PERFORM log_auth_event('conta_excluida', p_user_id, p_ip_hash, p_user_agent,
                           jsonb_build_object('vinculos_encerrados', coalesce(v_ended, 0)));
END IF;

RETURN jsonb_build_object('hook', v_hook, 'assignments_ended', v_ended);
```

- O `EXECUTE` usa **texto constante**; o único valor externo entra por `USING`. É a única exceção à
  regra "sem SQL dinâmico", necessária porque a função da `003` é criada depois (0020+).
- **Falha fechada**: se existe a tabela de vínculos e não existe a operação que os encerra, nada é
  excluído. Se a operação lançar erro, a transação inteira é desfeita.
- Idempotente: repetir encerra zero vínculos e não duplica o evento.
- Não apaga `perfis` nem `auth.users` (isso é do passo 8) e **não toca** em `tag_codes`.

## O que acontece com cada dado

| Dado | Destino | Quem faz |
|---|---|---|
| `auth.users`, identidades, sessões | apagados | `auth.admin.deleteUser` |
| `perfis` (nome, e-mail, celular, aceite) | apagado | `ON DELETE CASCADE` de `perfis.id` |
| `phone_verifications`, `rate_limit_events` da conta | apagados | `delete_account_data` |
| `auth_audit_log` | linhas ficam com `ator = NULL` | `ON DELETE SET NULL` (da `001`) |
| Vínculos ativos de tag | encerrados com `account_deleted` | `end_assignments_for_account` (`003`) |
| Códigos de tag | **intactos** | — |
| Scans dos vínculos | coordenadas, cidade e região apagadas; hora e contagem ficam | `end_assignments_for_account` (`003`) |
| Pets e perfis de resgate | apagados | `ON DELETE CASCADE` de `pets.tutor_id` (`003`) |
| Fotos em `pet-photos/<uid>/` | apagadas | passo 7 |

## Limites e auditoria

- `reauth:account`: 5 falhas em 15 min.
- Eventos: `reautenticacao_falha` `{ acao: "excluir_conta" }`; `conta_excluida`
  `{ vinculos_encerrados: n }` (o `ator` vira nulo quando o usuário é apagado).

## Testes

pgTAP (`supabase/tests/conta_privacidade.test.sql`):

- `anon` e `authenticated` não executam `delete_account_data` (`42501`).
- Sem a função e sem a tabela da `003` ⇒ devolve `hook = 'absent'` e apaga as verificações.
- Com uma tabela `public.tag_assignments` criada no teste e **sem** a função ⇒ lança
  `deletion_hook_missing` e as verificações **continuam** lá.
- Com uma função `end_assignments_for_account` de teste que devolve 2 ⇒ `hook = 'called'`,
  `assignments_ended = 2`, evento `conta_excluida` com `vinculos_encerrados = 2`.
- Com uma função de teste que lança erro ⇒ a exceção sobe e nada é apagado.
- Chamar duas vezes ⇒ um único evento `conta_excluida`.
- Depois de `DELETE FROM auth.users WHERE id = …` (simulando o passo 8): `perfis` sumiu; os eventos
  de `auth_audit_log` da conta existem com `ator IS NULL`.

Deno (`supabase/functions/account-delete/logic.ts`): validação de `confirm`; paginação da remoção
de fotos (0, 1, 100 e 250 arquivos, com um cliente de storage falso).

E2E (`e2e/account.spec.ts`): excluir com senha errada (nada muda) e com senha certa (não consegue
mais entrar; o mesmo e-mail consegue se cadastrar de novo).
