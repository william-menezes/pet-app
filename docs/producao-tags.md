# Produção das tags (lotes e etiquetas)

Notas de produção de `specs/003-tag-qr/contracts/label-rendering.contract.md` e o caminho de contingência
enquanto a etiqueta não é gerada pelo servidor (T084 e T085, bloqueadas: faltam a fonte
`JetBrainsMono-Bold.ttf` e as máscaras do lote-001).

> **Segurança.** O repositório é público. PINs em texto puro (`lote.csv`, `pins.csv`) e listas de códigos reais
> **nunca** vão para o git, para o chat, para um log ou para um comentário de PR. Apague o arquivo local depois de
> usar.

## O que existe hoje

| Peça | Estado |
|---|---|
| Edge Function `admin-create-batch` | Cria o lote (1 a 500 códigos), grava só hashes de PIN e devolve um ZIP com **`pins.csv`** (`code,pin`). **Sem etiquetas.** Só desenvolvimento: não fazer deploy em produção antes de T011 (54 códigos do lote-001 contra `isValid`) e T085 (matriz e máscara do QR contra o script de referência). |
| RPC `admin_export_codes(p_batch)` | Devolve o CSV `code,qr_version,qr_mask` do lote, **sem PIN**. É o "Exportar códigos do lote" da tela de lotes. Grava o evento `codes_exported`. |
| `admin-labels` (PDF das etiquetas) | **Não existe** (T084 bloqueada). |
| `tools/tag-generator/gerar_tags.py` | Referência do desenho. **Gera os próprios códigos** (`--qtd`); não lê uma lista de códigos de fora. |

## Por que o lote de produção não sai de `admin-create-batch` ainda

O script de referência não aceita uma lista de códigos: ele sorteia os códigos e escreve o `lote.csv` junto com
as folhas de etiquetas. Logo, um lote criado pelo `admin-create-batch` **não tem como ser impresso** com o
script, e o servidor ainda não gera o PDF. Enquanto T084 não existe, o caminho para uma tag física é o mesmo do
lote-001:

1. Gerar o lote **no script**, na máquina de quem imprime (veja `tools/tag-generator/README.md`):
   `python gerar_tags.py --diametro 22 --altura 20 --out ./lote-002`. A pasta fica fora do git.
2. Ler a máscara de cada código no `qr.mask` do script e importar no banco pelo procedimento de
   [importar-lote-001.md](importar-lote-001.md) (troque o id do lote, `lote-001`, por `lote-002`; os passos de
   máscara, `crypt` do PIN e conferência são os mesmos).
3. Conferir o lote importado com o CSV de códigos do banco:
   o admin usa "Exportar códigos do lote" (RPC `admin_export_codes`) e compara a lista com `codes.txt` do script
   (mesmos 54 códigos, mesma máscara). **Nenhum PIN** passa por esse CSV.
4. Apagar `lote.csv` da máquina depois da importação.

## Id do lote

- `lote-001` é o lote **impresso**: entra por importação de arquivo e nunca é gerado pelo sistema.
- Ids de produção vão de `lote-002` a `lote-899`. O próximo id de `admin_insert_batch` é o maior número
  existente nessa faixa mais um, no mínimo `lote-002`. Mesmo sem o `lote-001` no banco, o primeiro lote criado
  pelo sistema é `lote-002`, para nunca colidir com o lote impresso.
- Ids de `lote-900` a `lote-999` são reservados ao seed de desenvolvimento e a testes e **não contam**: o seed usa
  `lote-900`, e o próximo lote de produção continua sendo `lote-002`, não `lote-901`.
- Passou de `lote-899`, a função responde `batch_range_exhausted`.

## Notas de produção física

- Adesivo de vinil ou PET branco **opaco**. Papel comum absorve a resina e mata o contraste.
- Laser ou tinta pigmentada.
- Resina resistente a UV, rente à borda, sem cúpula. Evitar bolhas sobre os padrões de posição.
- Escanear antes e depois da resina com um iPhone e um Android. O maior risco é o reflexo da resina.
- Impressão em 100%, sem "ajustar à página"; confira a régua de 50 mm da folha.
- Cada cartão leva o PIN do código dele; o PIN **nunca** vai na etiqueta.

## Limites de segurança da criação de lote

- 10 lotes por hora por admin (estouro: `too_many_requests`, com o evento `admin_rate_limited` na auditoria).
- Reemitir PIN e encerrar vínculo: 60 por hora por admin, cada um.
- O pacote com os PINs sai **uma vez só** (`package_downloaded_at`): se a resposta se perder, anule o lote ou
  reemita os PINs código a código.
