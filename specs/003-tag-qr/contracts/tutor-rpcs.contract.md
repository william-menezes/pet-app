# Contrato: operações do tutor

Todas são RPCs `security definer` com `search_path` fixo, `EXECUTE` para `authenticated`, e usam
`auth.uid()` como identidade. O frontend traduz o código de erro em texto. **Nenhuma mensagem
revela a situação de uma tag que não é do tutor.**

## Formato de resposta (vale para todas as RPCs deste arquivo)

**Nenhuma RPC daqui lança exceção para erro de negócio.** O PostgREST roda cada chamada numa
transação: um `RAISE EXCEPTION` desfaz tudo o que a função gravou antes dele, inclusive o contador
de PIN errado e o registro do limite de chamadas. Com exceção, o bloqueio por tentativas **nunca
dispararia**. Por isso:

- Sucesso: objeto `jsonb` com `"ok": true` mais os campos descritos em cada função.
- Erro de negócio (todos os códigos da tabela abaixo): `{ "ok": false, "error": "<código>" }`, com
  `"retry_after_seconds"` quando o código for `locked` ou `too_many_requests`. A função **retorna**
  (não lança), e o que ela gravou antes fica gravado.
- As funções descritas abaixo como `returns void` passam a `returns jsonb` e devolvem
  `{ "ok": true }`. Onde um exemplo de saída abaixo não mostrar `"ok"`, acrescente-o.
- `RAISE EXCEPTION` fica só para o que não deveria acontecer (violação de integridade, erro interno).
- Nos testes pgTAP, erro de negócio se confere com `is(resultado ->> 'error', '<código>')`, nunca
  com `throws_ok`: o `throws_ok` desfaz a transação e esconde exatamente o defeito que esta regra
  evita.
- No frontend, os serviços de `core/tags/` tratam `ok === false` como erro de negócio e só tratam
  o erro do cliente Supabase como falha de rede ou interna.

## Códigos de erro

| Código | Significado | Texto ao tutor |
|---|---|---|
| `invalid_code` | código com formato ou dígito inválido | "Confira o código. Ele fica embaixo do QR." |
| `tag_unavailable` | tag inexistente, vinculada a outra pessoa, bloqueada ou anulada | "Não é possível usar esta tag. Fale com o suporte." |
| `wrong_pin` | PIN não confere | "PIN incorreto. Confira o cartão." |
| `locked` | conta ou tag travada | "Muitas tentativas. Tente de novo em alguns minutos." |
| `pet_not_found` | pet não é do tutor | "Não encontramos este pet." |
| `pet_has_tag` | pet já tem tag e `p_replace` é falso | (pede confirmação de troca) |
| `phone_not_confirmed` | celular não confirmado | "Confirme seu celular para continuar." |
| `not_entitled` | `can_link_tag` negou (não ocorre no MVP) | "Não foi possível vincular mais uma tag." |
| `not_owner` | a tag não é do tutor | "Não encontramos esta tag na sua conta." |
| `no_active_tag` | pet sem tag ativa | "Vincule uma tag a este pet primeiro." |

## `check_tag_for_link(p_code text) returns jsonb`

Para a tela "Vincular tag" mostrar "Código válido · tag disponível".
- Saída: `{ "ok": true, "code": "7K3M-Q9XA-C" }` ou erro `invalid_code` / `tag_unavailable`.
- Limite: 10 chamadas por minuto por conta; estouro: `locked`.

## `activate_tag(p_code text, p_pin text, p_pet_id uuid, p_replace boolean default false, p_enable_whatsapp boolean default false) returns jsonb`

Ordem das verificações (a ordem importa para não vazar informação):
1. Normaliza e valida `p_code` → `invalid_code`.
2. Celular confirmado (`phone_is_confirmed(auth.uid())`) → `phone_not_confirmed`.
3. Pet pertence ao tutor → `pet_not_found`.
4. Bloqueio por conta+tag ou por tag ainda vigente → `locked`.
5. Trava a linha de `tag_codes` (`FOR UPDATE`). Linha inexistente ou `status <> 'available'` →
   `tag_unavailable`.
6. Confere o PIN (`crypt(p_pin_normalizado, hash) = hash`). Errado: incrementa os dois contadores,
   aplica bloqueio se atingiu o limite, grava `activation_failed` (e `activation_locked_*`) →
   `wrong_pin` ou `locked`.
7. `can_link_tag(auth.uid())` → `not_entitled`.
8. Pet com tag ativa: se `p_replace` é falso → `pet_has_tag`; se verdadeiro, encerra o vínculo
   anterior com `released` e devolve a tag anterior a `available` **mantendo o PIN vigente**
   (`activation_pin_hash` não muda). Regra da constituição v2.1.0: só se gera PIN novo quando há
   alguém na tela para recebê-lo; aqui não há tela de PIN, então o cartão da tag antiga continua valendo.
9. Cria o vínculo, `status = 'assigned'`, zera contadores, apaga a ativação pendente, grava
   `tag_activated`. **Só liga `show_whatsapp` se `p_enable_whatsapp` for verdadeiro**: o tutor
   marca isso num controle visível na tela do PIN ("Quero que quem achar o [pet] possa me chamar
   no WhatsApp"), que começa **marcado**, com o aviso ao lado (decisão do William em 2026-11-21).
   **O padrão do parâmetro na RPC continua `false`**: a tela envia a escolha de forma explícita, e
   quem chamar a RPC sem o parâmetro não liga contato nenhum.

- Saída: `{ "code": "7K3M-Q9XA-C", "pet_id": "…", "pet_name": "Paçoca", "whatsapp_enabled": true }`.
- Tudo numa transação. Duas chamadas simultâneas: uma vence, a outra recebe `tag_unavailable`.
- O PIN nunca é gravado em `audit_log` nem em log.

## `release_tag(p_code text, p_reason text) returns jsonb`

- `p_reason` em (`'released'`, `'transferred'`). Tag precisa ter vínculo ativo do tutor → senão `not_owner`.
- Encerra o vínculo, desliga o modo perdido do pet, gera PIN novo, grava o hash, `status = 'available'`,
  grava `tag_released`.
- Saída: `{ "code": "7K3M-Q9XA-C", "new_pin": "K47Q9M" }`. **Única vez em que o PIN novo existe em claro.**
- A tela mostra o PIN com o aviso "Anote agora. Ele não aparece de novo." e um botão de copiar.

## `request_tag_replacement(p_code text, p_kind text) returns jsonb`

- `p_kind = 'damaged'`: cria o pedido `open`. A tag continua funcionando.
- `p_kind = 'lost'`: cria o pedido, encerra o vínculo com `lost`, `status = 'void'`, desliga o modo
  perdido. Irreversível; a tela pede confirmação explicando que o endereço antigo deixa de funcionar.
- Grava `replacement_requested`. Saída: `{ "request_id": "…" }`.

## `set_lost_mode(p_pet_id uuid, p_on boolean, p_message text, p_show_since boolean, p_show_reward boolean) returns void`

- Pet do tutor → senão `pet_not_found`. Ligar exige tag ativa → senão `no_active_tag`.
- Ligar: `lost_mode = true`, `lost_since = now()` (se já estava ligado, mantém a data), grava recado
  (até 280) e opções. Desligar: `lost_mode = false`, `lost_since = null`; o recado é mantido como
  rascunho para a próxima vez.
- Grava `lost_mode_on` / `lost_mode_off`.

## Ativação pendente

- `set_pending_activation(p_code text) returns void`: guarda o código normalizado para a conta, vale
  7 dias; substitui o anterior. Não consulta `tag_codes` (não é oráculo). Código inválido: `invalid_code`.
- `get_pending_activation() returns jsonb`: `{ "code": "7K3M-Q9XA-C" }` ou `null`.
- `clear_pending_activation() returns void`.

## `my_dashboard() returns jsonb`

Uma chamada para o painel: pets do tutor (id, nome, espécie, `photo_path`, tag ativa ou não, modo
perdido), scans do mês por pet, último scan (hora, método), contagem "estranhos veem X de Y" por
pet e a ativação pendente. As URLs das fotos são assinadas no cliente autenticado.

## Acesso direto por tabela (com RLS)

| Operação | Como |
|---|---|
| Criar, editar, remover pet | `insert` / `update` / `delete` em `pets` (política: `tutor_id = auth.uid()`). Remover pet com tag ativa: o app chama `release_tag` antes, com confirmação. |
| Ler e salvar "o que estranhos veem" | `select` / `update` em `rescue_profiles`, só colunas `show_*` e `lost_show_*`; `lost_mode`, `lost_since` não são atualizáveis direto (privilégio de coluna). |
| Ler vínculos | `select` em `tag_assignments` onde `tutor_id = auth.uid()`. |
| Ler scans | view `my_scans` (sem `ip_hash` nem token) filtrada pelos vínculos do tutor. |
| Foto | upload para `pet-photos/<uid>/<pet_id>/…`; depois `update pets set photo_path`. |

## Operação para `004-conta-tutor`

`end_assignments_for_account(p_tutor uuid) returns int` e
`export_tutor_tag_data(p_tutor uuid) returns jsonb` — só `service_role`. O contrato completo
(passos, idempotência, formato da exportação e testes) está em
`integration-002-004.contract.md` §4. Resumo da primeira: encerra todos os vínculos ativos do
tutor com `account_deleted`, devolve as tags a `available` **mantendo o PIN vigente**, desliga
modos perdidos, apaga a localização dos scans de todos os vínculos do tutor (mantém a contagem e a
hora), limpa ativações pendentes e tentativas, fecha pedidos de segunda via abertos e devolve
quantos vínculos encerrou. Não apaga códigos. Pode ser chamada duas vezes.

## Testes obrigatórios (pgTAP)

- PIN certo ativa; PIN errado não ativa e conta tentativa. **Depois de um `wrong_pin`, a linha de
  `tag_pin_attempts` existe e `tag_codes.pin_fail_count_24h` subiu** (prova de que a contagem não
  foi desfeita pelo erro).
- Chamadas que falham antes do PIN (`invalid_code`, `pet_not_found`, `tag_unavailable`) também
  contam no limite de chamadas: a 11ª `check_tag_for_link` com código inválido em um minuto
  devolve `locked`.
- 5 erros em 15 min → `locked` para aquela conta; outra conta ainda consegue tentar.
- 20 erros em 24 h → tag travada para todos; evento de auditoria presente.
- PIN certo durante bloqueio → `locked`.
- Tutor A não ativa tag em pet do tutor B (`pet_not_found`).
- Tag `assigned`, `blocked`, `void` e inexistente → todas `tag_unavailable` (mesma mensagem).
- Duas ativações concorrentes da mesma tag → exatamente uma com sucesso.
- `release_tag`: PIN antigo deixa de funcionar; PIN novo funciona uma vez.
- Troca de tag (`p_replace = true`): a tag anterior volta a `available` e o PIN dela **continua
  funcionando**; `activation_pin_hash` da tag anterior não muda.
- `activate_tag` sem `p_enable_whatsapp`: `show_whatsapp` fica `false`.
- Depois de transferir, o novo tutor não lê scans antigos e o antigo não lê os novos.
- `set_lost_mode` sem tag ativa → `no_active_tag`.
- `show_whatsapp = true` com celular não confirmado → recusado.
- Nenhuma RPC devolve `activation_pin_hash`, `ip_hash` ou ids de outro tutor.
