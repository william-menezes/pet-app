# Contrato: funções SQL da conta (migrations 0012 e 0013)

Todas `SECURITY DEFINER`, `SET search_path = public, pg_temp`, sem SQL dinâmico. Erros por
`RAISE EXCEPTION '<código>'`. Privilégios: `data-model.md` §5.

---

## `handle_new_user()` — gatilho `on_auth_user_created` (substitui a versão da `001`)

Dispara `AFTER INSERT ON auth.users`. Continua criando a linha de `perfis` com
**`papel = 'tutor'` fixo**. Passa a ler de `NEW.raw_user_meta_data`:

| Metadado | Vai para | Regra |
|---|---|---|
| `name` (ou `full_name`; senão a parte local do e-mail) | `perfis.nome` | `btrim`, cortado em 80 caracteres |
| `phone` | `perfis.celular_pendente` | só se casar com `^\+55[1-9][0-9]9[0-9]{8}$`; senão `NULL` |
| `terms_version` | `perfis.termos_versao` e `termos_aceitos_em = now()` | só se casar com `^[0-9]{4}-[0-9]{2}$`; senão os dois `NULL` |

Regras:

- Método do cadastro: `coalesce(NEW.raw_app_meta_data->>'provider', 'email')`.
  Quando **não** é `'email'` (Google), `phone` e `terms_version` dos metadados são **ignorados**:
  o aceite e o celular dessas contas só entram pelas telas do app.
- Qualquer outra chave dos metadados (`papel`, `role`, `is_admin`, `return_to`…) é ignorada.
- `ON CONFLICT (id) DO NOTHING` (idempotente, como na `001`).
- Auditoria: `conta_criada` `{ "metodo": "email" | "google" }` e, se houve aceite,
  `termos_aceitos` `{ "versao": … }`. A auditoria fica num bloco
  `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING …; END`: **uma falha de auditoria nunca impede
  o cadastro**. A criação da linha de `perfis` fica fora desse bloco.
- O celular **nunca** é gravado em `perfis.celular` aqui.

## `accept_terms(p_versao text) returns void`

- `EXECUTE`: `authenticated`. Usa `auth.uid()`.

| Erro | Condição |
|---|---|
| `not_authenticated` | sem sessão |
| `invalid_version` | `p_versao` não casa com `^[0-9]{4}-[0-9]{2}$` |

- Se `termos_versao` já é igual a `p_versao`: não faz nada (idempotente, sem novo evento).
- Senão: grava `termos_aceitos_em = now()`, `termos_versao = p_versao` e audita `termos_aceitos`
  `{ "versao": p_versao }` (com `ip_hash = ''`, `user_agent = ''`).

## `log_logout() returns void`

- `EXECUTE`: `authenticated`. Fecha a lacuna de auditoria de saída deixada pela `001`.
- Sem sessão: não faz nada. Chama `rate_limit_check` (`logout:account:h`, 20 por hora); negado:
  não faz nada. Permitido: grava `logout` para `auth.uid()` com `detalhe = '{}'`.
- Nunca lança erro (a saída não pode falhar por causa da auditoria).

## `my_account() returns jsonb`

- `STABLE`. `EXECUTE`: `authenticated`. Usa `auth.uid()`; sem sessão lança `not_authenticated`.

```json
{
  "id": "<uuid>",
  "nome": "Ana Souza",
  "email": "ana@email.com",
  "papel": "tutor",
  "celular": "+5511987654421",
  "celular_confirmado_em": "2026-11-21T12:03:00Z",
  "celular_pendente": null,
  "termos_aceitos_em": "2026-11-21T11:58:00Z",
  "termos_versao": "2026-11",
  "tem_senha": true,
  "provedores": ["email", "google"],
  "criado_em": "2026-11-21T11:58:00Z"
}
```

- `tem_senha`: `auth.users.encrypted_password` não nulo e não vazio.
- `provedores`: `auth.identities.provider` distintos da conta, em ordem alfabética.
- Só dados da própria conta. É a leitura que o app usa para montar `AccountStore`.

## `account_auth_facts(p_user_id uuid) returns jsonb`

- `STABLE`. `EXECUTE`: só `service_role`. Usada pelas Edge Functions.

```json
{
  "email": "ana@email.com",
  "email_confirmed": true,
  "has_password": true,
  "providers": ["email"],
  "last_sign_in_at": "2026-11-21T11:59:00Z",
  "terms_accepted": true,
  "phone": null,
  "pending_phone": "+5511987654421"
}
```

- Conta inexistente ⇒ lança `account_not_found`.
- **Nunca** devolve o hash da senha.

## `audit_auth_user_changes()` — gatilho `on_auth_user_updated` (0013)

`AFTER UPDATE OF email_confirmed_at, encrypted_password, recovery_sent_at ON auth.users FOR EACH ROW`.

| Condição | Evento | `detalhe` |
|---|---|---|
| `OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL` | `email_confirmado` | `{}` |
| `NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password AND NEW.encrypted_password IS NOT NULL` | `senha_alterada` | `{ "apos_recuperacao": NEW.recovery_sent_at > now() - interval '1 hour' }` (nulo ⇒ `false`) |
| `NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at AND NEW.recovery_sent_at IS NOT NULL` | `senha_recuperacao_solicitada` | `{ "origem": "envio" }` |

- `ator = NEW.id`, `ip_hash = ''`, `user_agent = ''`.
- Corpo inteiro dentro de `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING …; END` e
  `RETURN NEW` sempre: **o gatilho nunca derruba login, confirmação ou troca de senha**.
- Não lê nem registra o valor de `encrypted_password`; só compara.

## Testes obrigatórios (pgTAP)

`supabase/tests/funcoes_conta.test.sql`:

- Inserir em `auth.users` com metadados `{ name, phone: "+5511987654421", terms_version: "2026-11" }`
  e `provider = email` ⇒ `perfis` com `celular_pendente` preenchido, `celular` nulo,
  `termos_versao = '2026-11'`, `papel = 'tutor'`; eventos `conta_criada` e `termos_aceitos`.
- Metadados com `papel: "admin"`, `role: "admin"` ⇒ `papel = 'tutor'`.
- Metadados com `phone: "+14155550100"` ou `"abc"` ⇒ `celular_pendente` nulo e o insert **não falha**.
- `provider = google` com `phone` e `terms_version` nos metadados ⇒ os dois ignorados.
- Nome com 200 caracteres ⇒ gravado com 80.
- `accept_terms('2026-11')` grava e audita uma vez; repetir não cria segundo evento;
  `accept_terms('abc')` ⇒ `invalid_version`; `anon` não executa.
- `my_account()` devolve a própria conta; não tem chave com `encrypted` ou `hash`; `anon` não executa.
- `account_auth_facts`: `authenticated` e `anon` não executam (`42501`).
- `log_logout()` grava `logout` para o chamador; a 21ª chamada em 1 hora não grava e não lança erro.

`supabase/tests/auditoria_auth_users.test.sql`:

- `UPDATE auth.users SET email_confirmed_at = now()` (era nulo) ⇒ 1 evento `email_confirmado`.
- `UPDATE … SET encrypted_password = <outro>` ⇒ 1 evento `senha_alterada`.
- `UPDATE … SET recovery_sent_at = now()` ⇒ 1 evento `senha_recuperacao_solicitada` com `origem = envio`.
- `UPDATE … SET last_sign_in_at = now()` ⇒ nenhum evento novo.
- Nenhum `detalhe` contém e-mail, telefone ou hash.

`supabase/tests/funcoes_auth_grants.test.sql` (migration 0009):

- `anon` e `authenticated` **não** executam `log_auth_event` nem `record_login_attempt` (`42501`).
- `service_role` executa as duas.
- `authenticated` continua executando `is_admin()` e `current_user_role()`; `anon` não.
- Os três arquivos de teste da `001` (`rls_perfis`, `rls_auth_audit`, `rate_limit`) continuam verdes.
