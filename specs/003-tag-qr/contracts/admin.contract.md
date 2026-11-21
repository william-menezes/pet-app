# Contrato: painel admin

Toda operação verifica `is_admin()` **dentro** da função ou da Edge Function. O guard de rota é só
conveniência. Telas de referência: `design/telas-v2/V2-admin-lotes*.dc.html`,
`V2-admin-codigos*.dc.html`, `V2-admin-codigo*.dc.html`. Admin é sempre no tema claro.

## Edge Function `admin-create-batch`

- **Autorização**: JWT de um admin (a função valida o token e chama `is_admin()` com ele).
- **Entrada**: `{ "quantity": number (1..500), "notes"?: string }`.
- **Passos**:
  1. Calcula o próximo id (`lote-NNN`, sequencial; o id do lote não é segredo).
  2. Para cada código: `newCode()` com `crypto.getRandomValues`; PIN de 6 caracteres; calcula a
     máscara do QR (versão 3, correção H) para a URL do código.
  3. Chama a RPC `admin_insert_batch` (uma transação): insere o lote e os códigos com
     `crypt(pin, gen_salt('bf', 12))`. Colisão de código (chave primária): gera outro e repete, até
     5 vezes por código.
  4. Monta o pacote: `etiquetas.pdf` (ver `label-rendering.contract.md`) e `pins.csv`
     (`code,pin` no formato de exibição).
  5. Responde com o pacote e grava `package_downloaded_at` e os eventos `batch_created` e
     `batch_package_downloaded`.
- **Saída**: `application/zip` com os dois arquivos, `Content-Disposition: attachment`,
  `Cache-Control: no-store`.
- **Regras**: os PINs em claro existem só na memória desta execução. Nada de PIN em log, em
  `audit_log` ou em tabela. Se a resposta falhar depois da gravação, os PINs estão perdidos: a tela
  orienta a anular o lote ou reemitir os PINs código a código.

## Edge Function `admin-labels` (reimpressão)

- **Entrada**: `{ "codes": string[] }` (1 a 540) ou `{ "batch_id": string }`.
- **Saída**: `application/pdf` com as etiquetas, usando `qr_version` e `qr_mask` gravados.
- Grava `labels_reprinted` com a lista de códigos. Não devolve nem conhece PINs.

## RPCs (`authenticated` + `is_admin()`; senão erro `forbidden`)

| RPC | Entrada | Efeito e saída |
|---|---|---|
| `admin_list_batches()` | — | lotes com quantidade e contagem por situação |
| `admin_list_codes(p_search text, p_status text, p_batch text, p_limit int, p_offset int)` | busca por código (normalizado), nome do pet ou nome/e-mail do tutor | linhas: código, lote, situação, pet e tutor (primeiro nome + inicial), último scan; e o total |
| `admin_code_detail(p_code text)` | — | lote, datas, situação, vínculo atual, histórico de vínculos, scans (sem `ip_hash`), estado do PIN: `{ used: boolean, used_at, fail_count_24h, locked_until }`, pedidos de 2ª via |
| `admin_set_status(p_code text, p_status text, p_note text)` | `p_status` em `available`, `blocked`, `void` | aplica a transição permitida (ver diagrama em `data-model.md`); `void` encerra o vínculo ativo com `admin` e é irreversível; grava `tag_status_changed` |
| `admin_reissue_pin(p_code text)` | só tag `available` | gera PIN novo, zera contadores; devolve `{ code, new_pin }` **uma vez**; grava `pin_reissued` |
| `admin_end_assignment(p_code text, p_reason text)` | `p_reason` em `admin`, `damaged`, `lost` | encerra o vínculo, tag volta a `available` com PIN novo; devolve `{ code, new_pin }` uma vez; grava `assignment_ended_by_admin` |
| `admin_resolve_replacement(p_request uuid, p_status text)` | `done` ou `cancelled` | fecha o pedido de 2ª via; grava `replacement_resolved` |
| `admin_scan_queue(p_limit int, p_offset int)` | — | scans com `status_at_scan` em `blocked`, `void`, `available`; pedidos de 2ª via abertos; tags travadas por tentativas |
| `admin_audit(p_event text, p_entity_id text, p_limit int, p_offset int)` | filtros opcionais | linhas do `audit_log`, mais recentes primeiro |
| `admin_dashboard_counters()` | — | códigos gerados, disponíveis, ativos, bloqueados, anulados |

- O admin **nunca** vê `activation_pin_hash`. `new_pin` só aparece na resposta de reemissão ou de
  encerramento de vínculo.
- `admin_set_status` para `blocked` em tag vinculada mantém o vínculo; a página pública passa a
  responder "tag não encontrada" e o tutor vê "Tag bloqueada. Fale com o suporte." no app.
- Não existe operação de apagar código nem lote.

## Telas e estados

| Tela | Conteúdo | Ações |
|---|---|---|
| Lotes | contadores, tabela de lotes, aviso "O pacote de um lote aparece uma vez só" | Criar lote (formulário: quantidade, observação; confirmação antes de gerar; download automático do pacote) |
| Códigos | busca, filtros por situação e lote, tabela com seleção | Reimprimir seleção |
| Detalhe do código | vínculo atual, scans, histórico de vínculos, ações | Bloquear/desbloquear, reemitir PIN, encerrar vínculo, reimprimir QR, trocar código (2ª via), anular |
| Fila | scans de tags não vinculadas, pedidos de 2ª via, tags travadas | abrir o código; marcar pedido como resolvido |
| Auditoria | lista filtrável | — |

- Toda ação destrutiva (anular, encerrar vínculo) pede confirmação com o código por extenso.
- PIN novo: mostrado numa caixa com "Copiar" e o aviso "Este PIN não aparece de novo".
- "Trocar código (2ª via)" no detalhe: anula o código (`void`) e orienta a enviar uma tag nova; o
  tutor ativa a nova normalmente com o PIN dela.
- Estados vazios e de erro terminam com um próximo passo.
- Celular e tablet: a tabela vira lista de cartões (ver telas).

## Testes obrigatórios

- Tutor comum chamando qualquer `admin_*` → `forbidden`; `anon` → sem permissão de execução.
- `admin-create-batch` sem JWT de admin → `403`; nenhuma linha criada.
- Lote de 54: 54 códigos distintos, todos válidos, todos `available`, máscara entre 0 e 7.
- O PIN de `pins.csv` ativa o código correspondente; o corpo da resposta não aparece em nenhum log.
- Segundo pedido do pacote do mesmo lote → recusado.
- `admin_set_status`: transições inválidas (sair de `void`) falham.
- `admin_reissue_pin` em tag `assigned` → recusado.
- Reimpressão de um código produz PDF igual ao da primeira impressão (mesmo hash do conteúdo de página).
- Tentativa de `delete` em `tag_codes` por qualquer role de aplicação → erro.
