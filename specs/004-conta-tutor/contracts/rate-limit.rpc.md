# Contrato: `rate_limit_check` (migration 0011)

Limitador genérico de janela deslizante sobre `public.rate_limit_events`. É o **ponto impositivo**
dos limites de SMS, de nova prova de identidade, de exportação e do pedido de recuperação feito
pelo app. Tabela e limites: `data-model.md` §3.

## Assinatura

```sql
CREATE FUNCTION public.rate_limit_check(p_checks jsonb, p_record boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

`EXECUTE`: só `service_role` (e funções `security definer` do dono do banco, como
`export_my_data`). `REVOKE ALL … FROM PUBLIC, anon, authenticated`.

## Entrada

`p_checks`: array JSON de 1 a 8 objetos:

```json
[{ "bucket": "sms:account:h", "key": "<texto>", "max": 5, "window": 3600 }]
```

- `bucket` e `key`: texto não vazio, até 200 caracteres. `max`: inteiro ≥ 1. `window`: segundos, 1 a 604800.
- Entrada malformada ⇒ `RAISE EXCEPTION 'invalid_checks'`.

`p_record`: `true` = se **todas** as checagens permitirem, grava um evento em cada uma;
`false` = só consulta.

## Saída

```json
{ "allowed": true,  "denied_bucket": null,            "retry_after_seconds": 0 }
{ "allowed": false, "denied_bucket": "sms:cooldown",  "retry_after_seconds": 42 }
```

## Comportamento

1. Para cada checagem, em ordem alfabética de `bucket || '|' || key` (evita impasse), obter
   `pg_advisory_xact_lock(hashtextextended(bucket || '|' || key, 0))`.
2. Apagar de `rate_limit_events` as linhas daquele par com `at < now() - interval '48 hours'`.
3. Contar as linhas do par com `at > now() - make_interval(secs => window)`.
4. Se `contagem >= max`: a checagem **nega**. `retry_after_seconds` = segundos até a linha mais
   antiga da janela sair dela (mínimo 1).
5. Se alguma nega: devolver `allowed = false`, o `denied_bucket` da **primeira na ordem recebida**
   que negou e o **maior** `retry_after_seconds` entre as que negaram. **Não grava nada.**
6. Se todas permitem e `p_record`: inserir uma linha por checagem. Devolver `allowed = true`.

Tudo ou nada: uma negativa em qualquer eixo não consome cota dos outros.

## Uso

| Chamador | `p_checks` | `p_record` |
|---|---|---|
| `phone-verify-start` | os 6 limites `sms:*` | `true` |
| `password-recovery` | `recovery:identity:h`, `recovery:ip:h` | `true` |
| `_shared/reauth.ts` (antes de conferir) | `reauth:account` | `false` |
| `_shared/reauth.ts` (depois de errar) | `reauth:account` | `true` |
| `export_my_data` | `export:account:d` | `true` |
| `log_logout` | `logout:account:h` | `true` |

**Falha fechada**: se a chamada falhar por qualquer motivo, o chamador trata como negado.

## Testes obrigatórios (pgTAP, `supabase/tests/rate_limit_events.test.sql`)

- `anon` e `authenticated` não executam a função (`42501`) nem leem ou escrevem a tabela.
- `max = 3`: três chamadas permitem, a quarta nega com `retry_after_seconds` entre 1 e `window`.
- Duas checagens na mesma chamada, a segunda no limite: nega e **não** incrementa a primeira.
- `p_record = false` não grava.
- Linhas com `at` forçado para antes da janela não contam.
- Linhas com mais de 48 h do par consultado são apagadas.
- Entrada malformada lança `invalid_checks`.
