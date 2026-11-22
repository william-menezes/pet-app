# Quickstart: Tag com QR Code

Como subir e conferir a feature numa máquina de desenvolvimento.

## Preparar

```bash
npm install
supabase start
supabase db reset            # aplica as migrations e o seed
supabase functions serve     # resolve-tag, register-scan, admin-create-batch, admin-labels
```

Variáveis do servidor SSR (arquivo `.env` local, nunca versionado):

```text
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1
FARO_SSR_KEY=<mesmo valor de supabase/.env.local>
IP_HASH_SECRET=<qualquer valor longo em desenvolvimento>
```

```bash
npm run build && npm run serve:ssr:faro   # SSR de verdade (a rota pública precisa dele)
```

## Dados do seed

Os códigos abaixo são ilustrativos. Os códigos reais do seed estão em `e2e/fixtures/seed-codes.json`.

| O quê | Valor |
|---|---|
| Tutora | `ana@email.com` (senha de desenvolvimento no `seed.sql`) |
| Pets | Paçoca (cão, tag `7K3M-Q9XA-C` ativa) e Mel (gata, sem tag) |
| Tag disponível | `2FX8-CN73-F` (PIN de desenvolvimento no `seed.sql`) |
| Tag bloqueada / anulada | `T6EV-BXPY-W` / `PYC6-D7XD-3` |
| Admin | `admin@faro.test` |

## Roteiro de conferência

1. **Resgate**: abra `http://localhost:4000/7K3M-Q9XA-C` em janela anônima. Veja o Paçoca e o botão
   do WhatsApp. Desligue o JavaScript e recarregue: a página continua útil.
2. **Mesma mensagem**: abra `/T6EV-BXPY-W`, `/PYC6-D7XD-3` e `/AAAA-AAAA-A`. As três são iguais.
3. **Normalização**: `/7k3m q9xa c` abre o Paçoca.
4. **Scan**: depois do passo 1, confira `select count(*) from scan_events;` e o e-mail no Inbucket
   (`http://127.0.0.1:54324`). Recarregue: a contagem não muda.
5. **Ativação**: abra `/2FX8-CN73-F`, toque em "Ativar minha tag", entre como Ana, escolha a Mel,
   digite o PIN. Veja "Tag ativa!" e a visão do dono.
6. **PIN errado**: repita com outra tag e erre 5 vezes. A sexta tentativa informa a espera.
7. **Modo perdido**: ative para o Paçoca e abra a página pública em janela anônima.
8. **Visibilidade**: desligue "Cuidados", salve, confira que o texto sumiu do código-fonte da página.
9. **Passar adiante**: em "Gerenciar tag", passe a tag do Paçoca adiante, anote o PIN novo, ative
   com outra conta e confira que ela não vê os scans da Ana.
10. **Admin**: entre como admin, crie um lote de 6, baixe o pacote, bloqueie um código e confira
    "tag não encontrada" na página pública.

## Testes

```bash
npm test -- --watch=false
supabase test db
deno test supabase/functions/
npm run e2e
```

## Leitura física da etiqueta (manual, depois de T084)

1. Imprima `etiquetas.pdf` em 100%, sem ajuste à página. Meça a régua: 50 mm.
2. Leia 5 etiquetas com um iPhone e 5 com um Android. Todas devem abrir `tagfaro.com.br/<código>`.
3. Aplique a resina numa amostra e repita a leitura sob luz forte e inclinada.
4. Registre aparelho, resultado e data no PR.

## Importar o lote-001 (uma única vez, em produção)

Siga `docs/importar-lote-001.md`. O arquivo `lote.csv` nunca entra no repositório.
