#!/usr/bin/env bash
# Dependencias das Edge Functions fixadas (specs/004-conta-tutor/contracts/security-hardening.contract.md, secao 5, T100).
# Reprova: import de URL sem versao exata (x.y.z), especificador jsr:/npm: sem versao exata, deno.json ausente ou com
# versao flutuante, deno.lock ausente, e a versao do supabase-js no codigo diferente da do deno.json.
# Roda sem rede e sem Deno. Linhas de comentario nao contam.
set -uo pipefail
cd "$(dirname "$0")/../.."

FAILED=0
fail() { echo "FAIL  $1"; FAILED=1; }
pass() { echo "PASS  $1"; }

DIR=supabase/functions
EXACT='@[0-9]+\.[0-9]+\.[0-9]+([/"'"'"'?#]|$)'

# Imports estaticos e dinamicos por URL, fora de comentarios.
IMPORTS="$(grep -rnE "(from[[:space:]]+|import[[:space:]]*\(?[[:space:]]*)[\"'](https?://|jsr:|npm:)" "$DIR" --include=*.ts \
  | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)" || true)"
FLOATING="$(printf '%s\n' "$IMPORTS" | grep -vE "$EXACT" | grep -v '^$' || true)"
if [ -n "$FLOATING" ]; then
  echo "$FLOATING"
  fail "ha import com versao flutuante em $DIR (use x.y.z exata)"
else
  pass "nenhum import com versao flutuante em $DIR ($(printf '%s\n' "$IMPORTS" | grep -c . || true) imports conferidos)"
fi

if [ -f "$DIR/deno.json" ]; then
  pass "$DIR/deno.json existe"
  MAPPED="$(grep -E '"[^"]+"[[:space:]]*:[[:space:]]*"(https?://|jsr:|npm:)' "$DIR/deno.json" | grep -vE "$EXACT" || true)"
  if [ -n "$MAPPED" ]; then echo "$MAPPED"; fail "deno.json tem mapeamento com versao flutuante"; else pass "todo mapeamento do deno.json tem versao exata"; fi
else
  fail "$DIR/deno.json nao existe"
fi

if [ -s "$DIR/deno.lock" ]; then pass "$DIR/deno.lock existe e nao esta vazio"; else fail "$DIR/deno.lock nao existe"; fi

CODE_URL="$(grep -rhoE "https://esm\.sh/@supabase/supabase-js@[0-9.]+" "$DIR" --include=*.ts | sort -u)"
MAP_URL="$(grep -oE "https://esm\.sh/@supabase/supabase-js@[0-9.]+" "$DIR/deno.json" 2>/dev/null | sort -u)"
if [ -n "$CODE_URL" ] && [ "$CODE_URL" = "$MAP_URL" ]; then
  pass "a versao do supabase-js no codigo e a do deno.json ($MAP_URL)"
else
  echo "codigo: $CODE_URL"; echo "deno.json: $MAP_URL"
  fail "a versao do supabase-js no codigo difere da do deno.json (ou ha mais de uma)"
fi

exit "$FAILED"
