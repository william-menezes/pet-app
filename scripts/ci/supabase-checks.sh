#!/usr/bin/env bash
# Conferencias de integracao do Supabase local no CI (spec 004-conta-tutor).
# Cobre o que o pgTAP nao alcanca: configuracao do Auth (T003), e-mail de confirmacao no coletor
# local (T004), login depois dos gatilhos (T017) e CORS da Edge Function login-guard (T021).
#
# Pre-requisito: `supabase start` ja executado. Roda TODAS as checagens e so no fim sai com erro,
# para um unico run mostrar tudo que falhou. Nunca imprime chaves, senhas ou tokens: so nomes e
# resultados. Valores de teste (e-mails @faro.test, senhas de seed) sao descartaveis.
set -uo pipefail

FAILED=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILED=1; }
check() { # check "descricao" <comando que deve retornar 0>
  local desc="$1"; shift
  if "$@"; then pass "$desc"; else fail "$desc"; fi
}

STATUS_ENV="$(supabase status -o env 2>/dev/null || true)"
API_URL="$(printf '%s\n' "$STATUS_ENV" | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' | head -1)"
ANON_KEY="$(printf '%s\n' "$STATUS_ENV" | sed -n 's/^ANON_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' | head -1)"
if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "FAIL  nao foi possivel ler API_URL/ANON_KEY de 'supabase status -o env'. Variaveis disponiveis:"
  printf '%s\n' "$STATUS_ENV" | cut -d= -f1
  exit 1
fi

signup() { # signup <email> <senha> [json-dos-metadados]
  local data="${3-}"
  if [ -z "$data" ]; then data="{}"; fi
  curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/signup" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"data\":$data}"
}

echo "== T003: configuracao do Auth =="
OUT="$(signup curta@faro.test 1234567)"
CODE="$(printf '%s' "$OUT" | tail -1)"; BODY="$(printf '%s' "$OUT" | sed '$d')"
echo "senha de 7 caracteres: HTTP $CODE; corpo: $(printf '%s' "$BODY" | cut -c1-160)"
check "senha de 7 caracteres e recusada pelo servidor (weak_password)" \
  bash -c '[ "$1" -ge 400 ] && printf "%s" "$2" | grep -q "weak_password"' _ "$CODE" "$BODY"

OUT="$(signup tutor.a@faro.test OutraSenha12345)"
CODE="$(printf '%s' "$OUT" | tail -1)"; BODY="$(printf '%s' "$OUT" | sed '$d')"
echo "cadastro repetido: HTTP $CODE"
check "cadastro repetido responde 200" test "$CODE" = "200"
check "cadastro repetido nao devolve sessao" bash -c '! printf "%s" "$1" | grep -q "access_token"' _ "$BODY"

echo "== T017: login continua funcionando depois dos gatilhos =="
LOGIN="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"tutor.a@faro.test","password":"TesteSenha123!"}')"
LCODE="$(printf '%s' "$LOGIN" | tail -1)"; LBODY="$(printf '%s' "$LOGIN" | sed '$d')"
echo "login do tutor A: HTTP $LCODE"
check "login do tutor A devolve sessao (200 com access_token)" \
  bash -c '[ "$1" = "200" ] && printf "%s" "$2" | grep -q "access_token"' _ "$LCODE" "$LBODY"
if [ "$LCODE" != "200" ]; then echo "corpo do login: $(printf '%s' "$LBODY" | cut -c1-200)"; fi

echo "== T004: e-mail de confirmacao no coletor local =="
EMAIL="ci-$RANDOM$RANDOM@faro.test"
OUT="$(signup "$EMAIL" SenhaDeTeste12345 '{"name":"CI Teste","phone":"+5511987654421","terms_version":"2026-11"}')"
CODE="$(printf '%s' "$OUT" | tail -1)"
echo "cadastro novo: HTTP $CODE"
check "cadastro novo responde 200" test "$CODE" = "200"

MAIL_HTML=""
for _ in $(seq 1 20); do
  IDS="$(curl -s "http://127.0.0.1:54324/api/v1/search?query=to:$EMAIL" | grep -oE '"ID":"[^"]+"' | head -1 | cut -d'"' -f4)"
  if [ -n "$IDS" ]; then
    MAIL_HTML="$(curl -s "http://127.0.0.1:54324/api/v1/message/$IDS")"
    break
  fi
  sleep 1
done
if [ -z "$MAIL_HTML" ]; then
  echo "coletor sem mensagem. Resposta bruta da API (primeiros 300 caracteres):"
  curl -s "http://127.0.0.1:54324/api/v1/messages" | cut -c1-300
  echo
  echo "Raiz do coletor (primeiros 200 caracteres):"
  curl -s "http://127.0.0.1:54324/" | cut -c1-200
  echo
fi
check "o coletor recebeu o e-mail de confirmacao" test -n "$MAIL_HTML"
check "o link contem /auth/confirmar-email?token_hash=" \
  bash -c 'printf "%s" "$1" | grep -q "/auth/confirmar-email?token_hash="' _ "$MAIL_HTML"
check "o link contem type=email" \
  bash -c 'printf "%s" "$1" | grep -Eq "type=email"' _ "$MAIL_HTML"
check "o e-mail nao contem /auth/v1/verify (ConfirmationURL)" \
  bash -c '! printf "%s" "$1" | grep -q "/auth/v1/verify"' _ "$MAIL_HTML"

echo "== T021: CORS do login-guard =="
mkdir -p supabase
cat > supabase/.env.local <<'ENVEOF'
HASH_SALT=ci-test-salt-0123456789
ALLOWED_ORIGINS=http://localhost:4200
FARO_ENV=test
ENVEOF
supabase functions serve --env-file supabase/.env.local > /tmp/functions-serve.log 2>&1 &
SERVE_PID=$!
trap 'kill $SERVE_PID 2>/dev/null || true; rm -f supabase/.env.local' EXIT

PRE=""
for _ in $(seq 1 60); do
  PRE="$(curl -s -i -X OPTIONS "$API_URL/functions/v1/login-guard" \
    -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: authorization,content-type,apikey" 2>/dev/null || true)"
  if printf '%s' "$PRE" | head -1 | grep -qE ' (200|204)'; then break; fi
  sleep 2
done
echo "preflight (cabecalhos, sem corpo):"; printf '%s' "$PRE" | tr -d '\r' | sed -n '1,12p'
check "OPTIONS devolve 204 ou 200" bash -c 'printf "%s" "$1" | head -1 | grep -qE " (200|204)"' _ "$PRE"
check "Access-Control-Allow-Origin e http://localhost:4200" \
  bash -c 'printf "%s" "$1" | tr -d "\r" | grep -qi "^access-control-allow-origin: http://localhost:4200$"' _ "$PRE"

EVIL="$(curl -s -i -X OPTIONS "$API_URL/functions/v1/login-guard" -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST" 2>/dev/null || true)"
check "origem fora da lista nao recebe Allow-Origin" \
  bash -c '! printf "%s" "$1" | grep -qi "^access-control-allow-origin:"' _ "$EVIL"

POST="$(curl -s -i -X POST "$API_URL/functions/v1/login-guard" -H "Origin: http://localhost:4200" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"phase":"pre_attempt","email":"ci-sem-conta@faro.test"}' 2>/dev/null || true)"
echo "POST pre_attempt:"; printf '%s' "$POST" | tr -d '\r' | sed -n '1p;$p'
check "POST ao login-guard segue respondendo a decisao (allow) com CORS" \
  bash -c 'printf "%s" "$1" | grep -q "\"decision\":\"allow\"" && printf "%s" "$1" | tr -d "\r" | grep -qi "^access-control-allow-origin: http://localhost:4200$"' _ "$POST"

if [ "$FAILED" -ne 0 ]; then
  echo "--- ultimas linhas do supabase functions serve ---"
  tail -n 30 /tmp/functions-serve.log || true
  exit 1
fi
echo "Todas as conferencias passaram."
