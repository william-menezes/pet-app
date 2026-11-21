# Contrato entre specs: `004-conta-tutor` ⇄ `003-tag-qr`

**Dependência cruzada.** Esta spec não desenha tabelas de tags, pets ou scans, e a `003` não
desenha a conta. O que cada lado entrega e consome está aqui. Lido em 2026-11-21 a partir de
`specs/003-tag-qr/{spec,plan,data-model,research}.md` e `contracts/tutor-rpcs.contract.md`.

> Quem implementa a `004` **não edita** `specs/003-tag-qr/`. Divergência entre este arquivo e a
> `003` é motivo para parar e relatar.

Ordem das migrations: `004` = 0008–0019; `003` = 0020–0034. Por isso a `003` pode referenciar os
objetos da `004` diretamente, e a `004` só chama os da `003` **em tempo de execução**.

---

## A. O que a `004` entrega para a `003`

### A1. O fato "celular confirmado?"

```sql
public.phone_is_confirmed(p_user_id uuid) returns boolean   -- migration 0015
```

- `EXECUTE` para `authenticated` e `service_role`. Um tutor só obtém `true` para a própria conta.
- Uso previsto pela `003`: `activate_tag` (passo 2, erro `phone_not_confirmed`), gatilho de
  `rescue_profiles` (`show_whatsapp`/`show_phone`), e funções com `service_role`.
- É a única pergunta permitida sobre o celular. A `003` **não** lê `celular_confirmado_em` nem
  `celular_pendente`.

### A2. O número para a página pública

- Coluna **`public.perfis.celular`** (`text`, E.164, ex.: `+5511987654421`).
- **Garantia**: `perfis.celular` só contém número confirmado por SMS (`CHECK` + privilégio de
  coluna + escrita só por `phone_verification_confirm`). Durante uma troca, continua valendo o
  número antigo.
- Primeiro nome: `split_part(btrim(perfis.nome), ' ', 1)`.
- `resolve_tag` (`security definer`, só `service_role`) lê essas duas colunas. **Nunca** ler
  `perfis.celular_pendente`.
- `perfis.celular` pode ser `NULL` (conta sem celular confirmado): a página não mostra contato por
  telefone.

### A3. Destino de retorno

- Toda tela de `/auth/*` aceita `?returnUrl=<caminho interno>`. O guard da `003` em
  `/ativar/<código>` redireciona visitantes sem sessão para
  **`/auth/criar-conta?returnUrl=/ativar/<código>`** (ou `/auth?returnUrl=…` para a boas-vindas).
- Depois de cadastro + confirmação de e-mail + confirmação do celular (ou depois de entrar), a
  `004` navega para o `returnUrl`.
- **Outro aparelho**: no cadastro por e-mail, o destino também é guardado nos metadados do
  usuário (`return_to`, `return_to_at`), vale 7 dias e é usado no primeiro login em qualquer
  aparelho. É o que o research §8 da `003` pede.
- Aceito: caminho que começa com `/`, sem `//`, sem `://`, sem `\`, até 200 caracteres, fora de
  `/auth`. `/ativar/7K3M-Q9XA-C` é aceito.
- O destino **não autoriza nada**. A `003` valida tudo de novo ao chegar (inclusive o código).
- A `004` não sabe o que é uma tag e não guarda o código: a "ativação pendente" é da `003`.

### A4. Guard e estado no frontend

```ts
// src/app/core/account/phone-confirmed.guard.ts
export const phoneConfirmedGuard: CanMatchFn;   // sem celular confirmado → /auth/celular?returnUrl=<rota tentada>

// src/app/core/account/account.store.ts
readonly phoneConfirmed: Signal<boolean>;
```

- A `003` pode usar o guard nas rotas de ativação e o signal para desabilitar "Telefone" e
  "WhatsApp" na tela de visibilidade.
- Ao receber `phone_not_confirmed` de uma RPC, a `003` navega para
  `/auth/celular?returnUrl=<rota atual>`.
- Guard é experiência; a regra de verdade é `phone_is_confirmed` dentro das RPCs da `003`.

### A5. Papel e perfil

- `perfis`, `papel_enum` e `is_admin()` continuam como na `001`. A `004` restringe o `UPDATE`
  direto em `perfis` à coluna `nome` (privilégio de coluna). A `003` não deve depender de
  atualizar outras colunas de `perfis` pelo cliente.

---

## B. O que a `004` consome da `003`

### B1. Encerrar vínculos e anonimizar scans de uma conta (já prevista na `003`)

```sql
public.end_assignments_for_account(p_tutor uuid) returns int   -- só service_role
```

Contrato da `003`: encerra todos os vínculos ativos do tutor com `account_deleted`, devolve as
tags a `available` **mantendo o PIN vigente** (decisão de 2026-11-21), desliga modos perdidos, apaga coordenadas, cidade e
região dos scans desses vínculos (mantém contagem e hora) e devolve quantos vínculos encerrou.
**Não apaga códigos.**

Como a `004` chama: de dentro de `delete_account_data`, **antes** de apagar o usuário (porque
`tag_assignments.tutor_id` é `ON DELETE SET NULL`; depois de apagar, não daria mais para achar os
vínculos da conta).

Exigências da `004` sobre essa operação:

1. **Idempotente**: chamar duas vezes para a mesma conta devolve 0 na segunda e não lança erro.
2. **Transacional**: roda na transação de quem chama; se lançar erro, nada fica pela metade.
3. **Não depende de `auth.uid()`** (é chamada com `service_role`).
4. Nunca altera `tag_codes.code` nem apaga linha de `tag_codes`.

**Falha fechada do lado da `004`**: se `public.tag_assignments` existir e a função não existir, a
exclusão de conta é recusada (`deletion_hook_missing`).

### B2. Pedidos à `003`

**Atendidos em 2026-11-21**: os cinco itens abaixo constam em
`specs/003-tag-qr/contracts/integration-002-004.contract.md` §4 (tarefa T019A da `003`, na fase de
fundação). A coluna da direita continua valendo enquanto a `003` não estiver implementada.

| # | Pedido | Enquanto não existir |
|---|---|---|
| 1 | `public.export_tutor_tag_data(p_tutor uuid) returns jsonb`, só `service_role`/definer: pets, perfis de resgate, vínculos (atuais e encerrados **da própria conta**) e scans desses vínculos, sem `ip_hash`, sem tokens, sem dados de outros tutores | `export_my_data` devolve `tags_e_pets: null` com uma observação |
| 2 | `end_assignments_for_account` também apagar `pending_activations` e encerrar `tag_replacement_requests` abertos da conta | ficam linhas órfãs com um `tutor_id` que não existe mais (sem dado pessoal) |
| 3 | Confirmar que `pets.tutor_id` é `ON DELETE CASCADE` para `auth.users` (está no data-model) e que `rescue_profiles` cai junto | — |
| 4 | Confirmar o nome do bucket (`pet-photos`) e o prefixo (`<uid>/`): a `004` apaga os arquivos sob esse prefixo na exclusão | bucket inexistente é ignorado |
| 5 | `ON DELETE` de `scan_events`/`audit_log` em relação ao tutor: nenhum identificador do tutor excluído deve permanecer legível | — |

### B3. O que a `004` **não** faz

- Não lê nem escreve `tag_codes`, `tag_assignments`, `scan_events`, `pets`, `rescue_profiles`,
  `pending_activations`.
- Não importa nada de `features/public`, `features/activation`, `features/pets`, `core/tags`.
- Não coloca guard nem sessão na rota `/:code`.

---

## C. Testes de contrato

Do lado da `004` (com funções e tabelas **de teste** criadas dentro do próprio arquivo pgTAP, cada
caso entre `SAVEPOINT` e `ROLLBACK TO`, de modo que o arquivo passe com ou sem os objetos de
verdade da `003`):

- `delete_account_data` chama `end_assignments_for_account` quando ela existe; recusa quando há a
  tabela e não há a função; propaga erro.
- `export_my_data` inclui o resultado de `export_tutor_tag_data` quando ela existe.
- `phone_is_confirmed`: os cinco casos de `phone-verification.rpc.md`.

Do lado da `003` (a registrar lá): `activate_tag` com conta sem celular ⇒ `phone_not_confirmed`;
`resolve_tag` nunca devolve número quando `perfis.celular` é nulo; depois de
`end_assignments_for_account`, a tag resolve como "não ativada" e o código continua existindo.

Integração final (quando as duas specs estiverem implementadas), em `quickstart.md` §8: excluir uma
conta com uma tag ativa e conferir que o código continua em `tag_codes`, que a página da tag mostra
"tag não ativada" e que nenhum dado do antigo tutor aparece.
