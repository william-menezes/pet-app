# Contrato: `export_my_data()` (migration 0016)

Exportação dos dados do titular (LGPD, Princípio II). RPC chamada pelo app; o navegador salva o
resultado como arquivo.

## Assinatura

```sql
CREATE FUNCTION public.export_my_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

`EXECUTE`: `authenticated`. Usa **só** `auth.uid()`; não recebe id de conta.

## Erros (`RAISE EXCEPTION '<código>'`)

| Código | Condição | Texto ao tutor |
|---|---|---|
| `not_authenticated` | sem sessão | (leva ao login) |
| `rate_limited` | mais de 3 em 24 h. `DETAIL` = segundos até poder de novo | "Você já exportou seus dados 3 vezes hoje. Tente de novo em {tempo}." |

## Saída

```json
{
  "formato": 1,
  "gerado_em": "2026-11-21T12:30:00Z",
  "conta": {
    "id": "<uuid>",
    "nome": "Ana Souza",
    "email": "ana@email.com",
    "papel": "tutor",
    "celular": "+5511987654421",
    "celular_confirmado_em": "2026-11-21T12:03:00Z",
    "celular_pendente": null,
    "metodos_de_login": ["email"],
    "criada_em": "2026-11-21T11:58:00Z",
    "atualizada_em": "2026-11-21T12:03:00Z"
  },
  "consentimentos": [
    { "tipo": "termos_e_privacidade", "versao": "2026-11", "aceito_em": "2026-11-21T11:58:00Z" }
  ],
  "eventos": [
    { "evento": "conta_criada", "em": "2026-11-21T11:58:00Z", "detalhe": { "metodo": "email" } }
  ],
  "tags_e_pets": null,
  "observacoes": []
}
```

Regras:

- `consentimentos`: vazio se não há aceite.
- `eventos`: linhas de `auth_audit_log` com `ator = auth.uid()`, da mais recente para a mais
  antiga, no máximo 1.000. Campos: `evento`, `at` (como `em`) e `detalhe`. **Sem** `ip_hash`, sem
  `user_agent`, sem `id`.
- `tags_e_pets`: se `to_regprocedure('public.export_tutor_tag_data(uuid)')` não for nulo, o
  resultado de `EXECUTE 'SELECT public.export_tutor_tag_data($1)' USING auth.uid()` (texto
  constante; mesma exceção documentada em `account-delete.edge.md`). Senão `null`, e
  `observacoes` recebe `"Dados de pets, tags e scans ainda não estão disponíveis nesta exportação."`.
- Nunca inclui: hash de senha, hashes de código ou de telefone, tokens, dados de outra conta.

## Passos

1. `auth.uid()` nulo ⇒ `not_authenticated`.
2. `rate_limit_check('[{"bucket":"export:account:d","key":<uid>,"max":3,"window":86400}]', true)`.
   Negado ⇒ `RAISE EXCEPTION 'rate_limited' USING DETAIL = <retry_after_seconds>`.
3. Montar o `jsonb`.
4. Auditar `dados_exportados` (`ator = auth.uid()`, `ip_hash = ''`, `user_agent = ''`, `detalhe = '{}'`).
5. Devolver.

A função é `VOLATILE` (grava limite e auditoria).

## Frontend

`PrivacyService.exportData()`:

1. `supabase.rpc('export_my_data')`.
2. Erro com `message === 'rate_limited'` ⇒ `{ ok: false, reason: 'rate_limited', retryAfterSeconds: Number(error.details) }`.
3. Sucesso ⇒ criar `Blob` (`application/json`, `JSON.stringify(data, null, 2)`) e disparar o
   download com o nome `faro-meus-dados-AAAA-MM-DD.json`. Revogar o `ObjectURL` em seguida.

O arquivo não é guardado no servidor.

## Segurança

- Sem nova prova de identidade: quem tem a sessão já lê esses dados pelo app. O limite de 3 por
  dia e o evento `dados_exportados` cobrem o abuso e a rastreabilidade.
- O evento `dados_exportados` aparece na exportação **seguinte** (não na que o gerou).

## Testes obrigatórios (pgTAP, `supabase/tests/conta_privacidade.test.sql`)

- `anon` não executa (`42501`).
- Tutor A: `conta.id` = A; nenhum valor do JSON contém o e-mail ou o id do tutor B.
- `eventos` só tem linhas com `ator = A`; nenhuma chave `ip_hash` ou `user_agent` em nenhum nível.
- Sem a função da `003`: `tags_e_pets` é `null` e há 1 observação. Com uma função
  `export_tutor_tag_data` de teste devolvendo `{"pets":[]}`: `tags_e_pets = {"pets":[]}` e
  `observacoes` vazio.
- 4ª chamada em 24 h ⇒ `rate_limited`.
- Cada chamada bem-sucedida grava 1 evento `dados_exportados`.
