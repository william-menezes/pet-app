# Importar o lote-001 no banco

Procedimento **manual e único** (`specs/003-tag-qr/research.md` §12). Fora das migrations: o lote-001 já
foi impresso, então cada código, cada PIN do cartão e cada máscara de QR são fatos físicos que o banco
tem de aceitar como estão (Princípio VIII). Quem importa precisa de acesso de dono ao banco de produção.

> **Segurança.** O repositório é público. `lote.csv` tem os PINs em texto puro e `codes.txt` tem os códigos
> reais: **nenhum dos dois vai para o git, para o chat, para um log ou para um comentário de PR**. Os
> comandos abaixo nunca imprimem um PIN. Faça tudo numa máquina sua, sem compartilhar a tela.

## Antes de começar

1. **T011 passou.** Rode `npm test -- --watch=false tag-code` com `tools/tag-generator/lote-001/codes.txt`
   presente: o teste "os 54 codigos do lote-001 passam em isValid" tem de rodar (não pode aparecer como
   pulado) e passar. Se falhar, o erro está no código novo, nunca no lote: pare e corrija o módulo.
2. As migrations `0020` a `0034` estão aplicadas no banco de destino (`select count(*) from public.tag_codes;`
   responde `0`, e `select public.tag_is_valid('7K3M-Q9XA-C');` responde `true`).
3. Os arquivos do lote estão em `tools/tag-generator/lote-001/` (pasta ignorada pelo git):
   `lote.csv` com as colunas `code,display,url,activation_pin`, e `codes.txt`.
4. `psql` instalado. A string de conexão direta (dono do banco) vem do painel do Supabase e fica numa
   variável de ambiente da sessão (`DATABASE_URL`); ela nunca é escrita em arquivo versionado.

## Passo 1: descobrir a máscara de cada código

O `lote.csv` **não** traz a máscara do QR (`qr_mask`, de 0 a 7), e o código novo não deve escolher uma:
duas implementações podem desempatar de forma diferente, e a reimpressão tem de sair idêntica à etiqueta
já impressa. A máscara de cada código é lida **do que foi impresso**, de uma destas formas:

- rodando o script de referência com o mesmo domínio e anotando `qr.mask` para cada código
  (`gerar_tags.py` monta o QR com `segno.make(url, error="h", micro=False, boost_error=False)`; o
  atributo `mask` do objeto devolvido é o número que se quer); ou
- lendo os bits de formato do QR de cada etiqueta impressa (os 15 bits de formato guardam a máscara).

Escolha um dos dois, vale para os 54. Guarde o resultado num **novo** arquivo local
`tools/tag-generator/lote-001/lote-com-mascara.csv`, com o cabeçalho:

```
code,display,url,activation_pin,qr_mask
```

(as quatro primeiras colunas copiadas do `lote.csv`, mais `qr_mask` de 0 a 7). Este arquivo também tem PINs
em claro: está dentro de `tools/tag-generator/lote-*/`, que o `.gitignore` já cobre.

## Passo 2: importar, numa única transação

Abra o `psql` e execute **tudo de uma vez** (se qualquer conferência falhar, dê `rollback;` e nada fica):

```bash
psql "$DATABASE_URL"
```

```sql
begin;

-- Tabela temporária: some sozinha ao fim da sessão, e é apagada de novo no fim deste passo.
create temp table lote_import (
  code           text,
  display        text,
  url            text,
  activation_pin text,
  qr_mask        smallint
);

\copy lote_import (code, display, url, activation_pin, qr_mask) from 'tools/tag-generator/lote-001/lote-com-mascara.csv' with (format csv, header true)

-- Conferências ANTES de gravar (cada uma tem de responder o valor da direita).
select count(*)                                                     as linhas        from lote_import;                                    -- 54
select count(distinct code)                                         as codigos       from lote_import;                                    -- 54
select count(*) filter (where not public.tag_is_valid(code))        as digito_errado from lote_import;                                    -- 0
select count(*) filter (where code <> public.tag_normalize(code))   as nao_canonico  from lote_import;                                    -- 0
select count(*) filter (where url <> 'HTTPS://TAGFARO.COM.BR/' || code) as url_errada from lote_import;                                   -- 0
select count(*) filter (where qr_mask is null or qr_mask not between 0 and 7) as mascara_ruim from lote_import;                           -- 0
select count(*) filter (where activation_pin !~ '^[0-9A-HJKMNP-TV-Z]{6}$')    as pin_ruim    from lote_import;                           -- 0

-- O lote e os 54 códigos. O PIN vira hash bcrypt com custo 12; o texto puro não é gravado em lugar nenhum.
insert into public.tag_batches (id, quantity, notes)
values ('lote-001', 54, 'Lote-001 impresso em 2026-11 (importado do lote.csv do script de referencia)');

insert into public.tag_codes (code, batch_id, activation_pin_hash, qr_version, qr_mask)
select code,
       'lote-001',
       extensions.crypt(public.tag_normalize(activation_pin), extensions.gen_salt('bf', 12)),
       3,
       qr_mask
  from lote_import;

-- Conferência DEPOIS de gravar.
select count(*)                                  as no_banco   from public.tag_codes where batch_id = 'lote-001';                         -- 54
select count(*) filter (where status = 'available') as disponiveis from public.tag_codes where batch_id = 'lote-001';                    -- 54
-- Cada PIN do arquivo confere com o hash gravado (54 de 54), sem imprimir nenhum PIN:
select count(*) as pins_conferem
  from lote_import l
  join public.tag_codes t on t.code = l.code
 where extensions.crypt(public.tag_normalize(l.activation_pin), t.activation_pin_hash) = t.activation_pin_hash;                              -- 54

-- Só então apague a tabela temporária e confirme.
drop table lote_import;

commit;
```

Se alguma resposta não for a da direita, **não dê `commit`**: dê `rollback;`, descubra a causa e recomece.
Um código com `digito_errado > 0` é erro do módulo novo (T011 deveria ter acusado), nunca do lote.

## Passo 3: conferência final (já com a transação confirmada)

```sql
select count(*) from public.tag_codes where batch_id = 'lote-001';                         -- 54
select count(*) from public.tag_codes where batch_id = 'lote-001' and status = 'available'; -- 54
select count(*) from public.tag_codes where batch_id = 'lote-001' and qr_version = 3;       -- 54
select count(*) from public.tag_codes where activation_pin_hash !~ '^\$2[abxy]\$12\$';       -- 0 (todo hash e bcrypt custo 12)
select count(*) from public.tag_batches where id = 'lote-001';                              -- 1
```

Depois, no app ou no admin: abra uma tag **de teste** do lote (não uma que vai para um cliente), confira que
`/<código>` mostra "tag não ativada" e que o PIN do cartão correspondente a ativa. Esse teste gasta a tag:
anule-a pelo admin (`void`) ou libere-a de novo (o PIN vigente continua valendo, mas o cartão dela já foi
visto por você).

## Passo 4: apagar os arquivos locais com PIN

Os dois CSV têm PIN em texto puro. Depois da importação e da conferência:

```bash
rm tools/tag-generator/lote-001/lote.csv tools/tag-generator/lote-001/lote-com-mascara.csv
git status --short   # nada de lote* pode aparecer: se aparecer, NÃO commite
```

Mantenha `codes.txt` e as folhas de etiquetas (`folha-*.pdf`) **só** na máquina de quem imprime: também são
sensíveis (a lista de códigos permite gastar o limite de erros de PIN de cada tag), mas não têm PIN. Os
cartões impressos são a única cópia dos PINs a partir de agora; o banco só tem o hash. Perdeu o cartão:
o admin reemite um PIN novo (`admin_reissue_pin`).

Também apague o histórico do `psql` desta sessão se ele guardou o caminho do arquivo (`\s` mostra; o PIN
nunca esteve em um comando, só no arquivo lido pelo `\copy`).

## Lotes novos

Lotes depois do 001 **não** passam por este procedimento: o admin cria o lote pela tela, a Edge Function
`admin-create-batch` gera códigos, PINs e máscaras e devolve o pacote uma única vez.
