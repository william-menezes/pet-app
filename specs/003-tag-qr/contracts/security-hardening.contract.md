# Contrato: endurecimento contra ataque e automação (003)

**Origem**: decisão do William em 2026-11-21. Complementa
`specs/004-conta-tutor/contracts/security-hardening.contract.md`, que traz as regras gerais, os
cabeçalhos, o desafio anti-robô, o portão de catálogo do banco e o CI. Este arquivo cobre só o que
é da tag. Onde endurece um número ou uma regra de outro contrato desta spec, vale este.

## 1. Página da tag: nada de terceiros

- **Nenhum desafio, CAPTCHA, script, fonte, imagem ou pedido a host de terceiro** em `/<código>`,
  "tag não ativada" e "tag não encontrada". Exceções únicas: a foto do pet (URL assinada do
  Storage) e, só depois de um toque do visitante, o mapa. O botão do WhatsApp é um link.
- A página usa a política `tag` de cabeçalhos (contrato da `004`, §3): CSP sem host de terceiro em
  `script-src`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- Todo link da página da tag para o app (ativar, entrar) é `<a href>` comum: navegação completa,
  para o documento do app carregar com a política dele.
- O piso de tempo de resposta (150 ms) vale para **os três estados** que não são a página de
  resgate (`not_found`, `available`, `rate_limited`), não só para `not_found`.

## 2. Chave entre o servidor do app e as Edge Functions (`x-faro-ssr-key`)

- Comparação em **tempo constante**: compara-se o SHA-256 dos dois valores com
  `crypto.subtle.timingSafeEqual` (ou equivalente). Nunca `===` direto na chave.
- **Rotação sem queda**: as funções aceitam `FARO_SSR_KEY` e, se definida, `FARO_SSR_KEY_PREVIOUS`.
  Para trocar: definir a nova como `FARO_SSR_KEY` e a antiga como `_PREVIOUS` nas funções, trocar
  no servidor do app, depois apagar a `_PREVIOUS`. O passo a passo vai para `quickstart.md`.
- A chave tem no mínimo 32 caracteres; menor que isso, a função responde `500` e não atende.
- **Teto global**, para o caso de a chave vazar (o limite por IP não protege, porque o `ip_hash`
  vem de quem chama):

| Escopo | Conta | Limite | No estouro |
|---|---|---|---|
| `resolve_global_min` | toda chamada a `resolve-tag` | 3.000 por minuto | `{ "state": "rate_limited" }` |
| `scan_global_min` | toda chamada a `register-scan` | 600 por minuto | `200`, sem efeito |

Estouro de teto global grava **um** evento de auditoria por minuto (`global_rate_limit`), para o
admin ver. Os números são folgados de propósito: o objetivo é conter abuso, não tráfego real.

## 3. `POST /api/scan` e `POST /api/scan/location`

- Corpo só em JSON, até 2 KB; fora disso, `413` ou `415`. Chave desconhecida: `400`.
- A checagem de mesma origem do contrato da página pública continua.
- O IP usado no `ip_hash` vem **só** dos cabeçalhos que a Vercel define (`x-real-ip` /
  `x-vercel-forwarded-for`); nunca do corpo, nunca do primeiro valor de um `x-forwarded-for` que o
  cliente possa ter escrito. Conferir no preview (T024A) qual cabeçalho a Vercel garante.
- Limite por origem, no `register-scan`, com `rate_limit_hit`:

| Escopo | Chave | Limite | No estouro |
|---|---|---|---|
| `scan_ip_min` | `ip_hash` | 20 por minuto | `200`, sem efeito (não grava scan, não envia e-mail) |
| `scan_ip_hour` | `ip_hash` | 200 por hora | idem |

## 4. Operações do tutor

Nova função interna `rpc_guard(p_scope text, p_limit int, p_window_seconds int)`, chamada no
começo de cada RPC, com chave `auth.uid()`. Usa `rate_limit_hit`.

| RPC | Escopo | Limite | No estouro |
|---|---|---|---|
| `activate_tag` (toda chamada, inclusive as que falham antes do PIN) | `activate_calls` | 30 em 15 min | `locked` |
| `release_tag`, `request_tag_replacement`, `set_lost_mode`, `set_pending_activation`, `clear_pending_activation` | `tutor_write_min` | 30 por minuto | `too_many_requests` |
| `my_dashboard`, `get_pending_activation` | `tutor_read_min` | 120 por minuto | `too_many_requests` |

- Código de erro novo, `too_many_requests`: "Muitas ações em pouco tempo. Aguarde um minuto."
- Os limites do PIN (5 erros em 15 min por conta e tag; 20 em 24 h por tag) não mudam.
- **Sem CAPTCHA no PIN**, e a decisão de `research.md` continua valendo: quem chega ao PIN já passou
  pelo desafio no cadastro e na entrada e já confirmou um celular por SMS, que custa dinheiro a
  quem automatiza. O que protege o PIN é o limite, não um desafio a mais.

**Tetos de recurso** (impedem encher o banco e o armazenamento com uma conta só):

- No máximo **20 pets por tutor**: gatilho em `pets` que recusa o 21º com `pet_limit` ("Você
  chegou ao limite de pets desta conta. Fale com o suporte.").
- Bucket `pet-photos`: `file_size_limit` de 5 MB e `allowed_mime_types` =
  `image/jpeg`, `image/png`, `image/webp`. A política de caminho (`<uid>/<pet_id>/…`) continua.
- No máximo 3 pedidos de 2ª via **abertos** por tutor.

## 5. Admin

- Toda Edge Function de admin confere o JWT **e** `is_admin()` dentro da função, `admin-labels`
  inclusive (o contrato do admin só dizia isso de forma geral).
- Limites, por admin: `admin-create-batch`, 10 por hora; `admin_reissue_pin` e
  `admin_end_assignment`, 60 por hora cada. Estouro: `too_many_requests`, com evento de auditoria.
- Segundo fator para o admin: recomendado, fora deste contrato (ver o contrato da `004`, §8).

## 6. Migration e portão de catálogo

- `0035_endurecimento_tags.sql`: `rpc_guard`, os escopos novos, o gatilho de limite de pets, o
  teto de pedidos de 2ª via, e a configuração do bucket.
- O portão `supabase/tests/security_catalog.test.sql` (criado na `004`) tem de continuar verde com
  todas as tabelas e funções da `003`. A lista de funções que `anon` pode executar continua
  **vazia**.

## 7. Testes obrigatórios

- pgTAP (`supabase/tests/endurecimento_tags.test.sql`): 31ª chamada a `activate_tag` em 15 min ⇒
  `locked`, mesmo com código inválido; 31ª escrita em 1 min ⇒ `too_many_requests`; 21º pet ⇒
  `pet_limit`; 4º pedido de 2ª via aberto recusado.
- `deno test`: chave errada, chave curta e ausência de chave ⇒ recusa; chave anterior aceita
  quando `_PREVIOUS` existe; tetos globais; `scan_ip_min` no 21º pedido devolve `200` sem gravar.
- E2E (`e2e/security/tag-page-hardening.spec.ts`): em `/<código>` nenhum pedido sai para host fora
  do próprio site e do Storage; os cabeçalhos da política `tag` estão presentes; o link de ativar
  causa navegação completa; corpo de 3 KB em `/api/scan` ⇒ `413`.
