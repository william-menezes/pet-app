# Contrato: código da tag

**Imutável (Princípio VIII).** Qualquer mudança aqui exige aprovação explícita do William e teste
cruzado contra os lotes já impressos. A referência é `tools/tag-generator/gerar_tags.py`.

## Formato

- Alfabeto Crockford Base32: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (sem `I`, `L`, `O`, `U`).
- Corpo: 8 caracteres aleatórios (fonte criptográfica). Dígito verificador: 1 caractere, Luhn mod 32.
- Forma canônica (armazenada): 9 caracteres, sem separador. Ex.: `7K3MQ9XAC`.
- Forma de exibição: `XXXX-XXXX-X`. Ex.: `7K3M-Q9XA-C`.
- URL impressa no QR: `HTTPS://TAGFARO.COM.BR/7K3MQ9XAC` (toda em maiúsculas, sem hífens).

## API do módulo (`core/tag-code/tag-code.ts`, espelhado em `supabase/functions/_shared/tag-code.ts`)

```ts
export const TAG_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const TAG_DOMAIN = 'TAGFARO.COM.BR';

/** Maiúsculas; remove hífens e espaços; O→0, I→1, L→1. Não valida. */
export function normalize(input: string): string;

/** true se, depois de normalizar, tem 9 caracteres do alfabeto e o dígito confere. */
export function isValid(input: string): boolean;

/** Dígito verificador Luhn mod 32 para um corpo de 8 caracteres já normalizado. */
export function checkDigit(body: string): string;

/** 'XXXX-XXXX-X' a partir de qualquer entrada válida; lança erro se inválida. */
export function format(input: string): string;

/** 'HTTPS://TAGFARO.COM.BR/<CODIGO>' em maiúsculas. */
export function tagUrl(input: string): string;

/** Código novo (corpo aleatório + dígito). Só nas Edge Functions. */
export function newCode(random: (n: number) => Uint8Array): string;
```

Sem dependência de Angular, Node ou Deno. Sem acesso a rede ou relógio.

## Espelho no banco

`tag_normalize(text)`, `tag_is_valid(text)` e `tag_format(char(9))`, `immutable`, mesma regra.

## Casos de teste obrigatórios

| Entrada | `normalize` | `isValid` |
|---|---|---|
| `7K3M-Q9XA-C` | `7K3MQ9XAC` | `true` (confirmado com a regra de referência) |
| `7k3m q9xa c` | `7K3MQ9XAC` | igual à linha acima |
| `7K3M-Q9XA-D` (dígito trocado) | `7K3MQ9XAD` | `false` |
| `OIL0-1111-?` | `01101111?` (o `?` não é do alfabeto) | `false` |
| `7K3MQ9XA` (8 caracteres) | igual | `false` |
| `7K3MQ9XACX` (10 caracteres) | igual | `false` |
| cadeia vazia | vazia | `false` |
| `U2345678X` (tem `U`) | igual | `false` |

> **Nota sobre os exemplos**: a variante do dígito verificador foi confirmada em 2026-11-21 contra
> `gerar_tags.py` e os 54 códigos do lote-001 (`research.md` §2). `7K3M-Q9XA-C` é válido. Os
> vetores de teste estão em `contracts/tag-code.vectors.json` (sintéticos; nenhum é código real).

- **Propriedade**: para 10.000 corpos aleatórios, `isValid(body + checkDigit(body))` é `true`, e
  trocar um caractere qualquer por outro do alfabeto torna `isValid` falso.
- **Cruzado (versionado)**: para cada item de `valid` em `fixtures/tag-code.vectors.json`,
  `checkDigit(body)` devolve `check` e `isValid(code)` é `true`; cada item de `invalid` é
  `false`; cada par de `normalize` confere. O mesmo arquivo alimenta o teste em SQL.
- **Cruzado (lote real, local)**: se `tools/tag-generator/lote-001/codes.txt` existir, os 54
  códigos são válidos em TypeScript e em SQL; se não existir, o teste é pulado com aviso. **Os
  códigos reais nunca são copiados para arquivo versionado** (repositório público).
- **Sincronia**: os dois arquivos TypeScript são idênticos byte a byte.
- **Domínio**: `tagUrl` nunca devolve outro domínio; teste busca `vercel.app` e outros domínios no
  código-fonte e falha se achar.

## PIN de ativação

6 caracteres do mesmo alfabeto, aleatórios, sem dígito verificador. Entrada normalizada como o
código (maiúsculas, `O→0`, `I→1`, `L→1`). Nunca em log, fixture, resposta de erro ou URL.
