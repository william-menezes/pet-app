#!/usr/bin/env bash
# Conferencias de integracao do Supabase local no CI (spec 004-conta-tutor).
# Cobre o que o pgTAP nao alcanca: configuracao do Auth (T003), e-mail de confirmacao no coletor
# local (T004), login depois dos gatilhos (T017) e CORS da Edge Function login-guard (T021).
#
# Pre-requisito: `supabase start` ja executado. Roda TODAS as checagens e so no fim sai com erro,
# para um unico run mostrar tudo que falhou. Nunca imprime chaves, senhas ou tokens: so nomes e
# resultados. Valores de teste (e-mails @faro.test, senhas) sao descartaveis, do stack local do CI.
set -uo pipefail

FAILED=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILED=1; }
check() { # check "descricao" <comando que deve retornar 0>
  local desc="$1"; shift
  if "$@"; then pass "$desc"; else fail "$desc"; fi
}
env_value() { # env_value NOME  (le de `supabase status -o env`, com ou sem aspas)
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p" | head -1
}

STATUS_ENV="$(supabase status -o env 2>/dev/null || true)"
API_URL="$(env_value API_URL)"
ANON_KEY="$(env_value ANON_KEY)"
SERVICE_KEY="$(env_value SERVICE_ROLE_KEY)"
if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "FAIL  nao foi possivel ler API_URL, ANON_KEY e SERVICE_ROLE_KEY de 'supabase status -o env'. Variaveis disponiveis:"
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
http_code() { printf '%s' "$1" | tail -1; }
http_body() { printf '%s' "$1" | sed '$d'; }

echo "== T003: configuracao do Auth =="
OUT="$(signup curta@faro.test 1234567)"
CODE="$(http_code "$OUT")"; BODY="$(http_body "$OUT")"
echo "senha de 7 caracteres: HTTP $CODE; corpo: $(printf '%s' "$BODY" | cut -c1-160)"
check "senha de 7 caracteres e recusada pelo servidor (weak_password)" \
  bash -c '[ "$1" -ge 400 ] && printf "%s" "$2" | grep -q "weak_password"' _ "$CODE" "$BODY"

# Usuario confirmado criado pela API de admin (so no stack local do CI). Os usuarios do seed.sql nao
# servem para estas conferencias: ver o diagnostico logo abaixo.
LOGIN_EMAIL="ci-login-$RANDOM$RANDOM@faro.test"
CR="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"SenhaDeTeste12345\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"CI Login\",\"terms_version\":\"2026-11\"}}")"
echo "usuario confirmado criado pela API de admin: HTTP $(http_code "$CR")"
check "API de admin cria o usuario (200)" test "$(http_code "$CR")" = "200"

OUT="$(signup "$LOGIN_EMAIL" OutraSenha12345)"
CODE="$(http_code "$OUT")"; BODY="$(http_body "$OUT")"
echo "cadastro repetido de e-mail ja confirmado: HTTP $CODE; error_code: $(printf '%s' "$BODY" | grep -oE '"error_code":"[^"]*"' | head -1)"
# O contrato (auth-config.contract.md) espera 200 ofuscado; o GoTrue local pode responder 422 user_already_exists.
# Diagnostico apenas: o cliente (RegistrationService) trata "usuario ja existe" como resposta uniforme.
check "cadastro repetido nao devolve sessao" bash -c '! printf "%s" "$1" | grep -q "access_token"' _ "$BODY"

echo "== T017: login continua funcionando depois dos gatilhos =="
LOGIN="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"SenhaDeTeste12345\"}")"
LCODE="$(http_code "$LOGIN")"; LBODY="$(http_body "$LOGIN")"
echo "login do usuario criado pela API de admin: HTTP $LCODE"
check "login devolve sessao (200 com access_token)" \
  bash -c '[ "$1" = "200" ] && printf "%s" "$2" | grep -q "access_token"' _ "$LCODE" "$LBODY"
if [ "$LCODE" != "200" ]; then echo "corpo do login: $(printf '%s' "$LBODY" | cut -c1-200)"; fi

echo "== Diagnostico (nao reprova): os usuarios do seed.sql entram pelo GoTrue? =="
SEEDLOGIN="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"tutor.a@faro.test","password":"TesteSenha123!"}')"
echo "login do tutor.a do seed: HTTP $SEEDLOGIN"
DBC="$(docker ps --filter name=supabase_db_ --format '{{.Names}}' | head -1)"
if [ -n "$DBC" ]; then
  docker exec "$DBC" psql -U postgres -At -c "select email, instance_id, confirmation_token is null as conf_null, recovery_token is null as rec_null, email_change is null as chg_null, aud from auth.users where email = 'tutor.a@faro.test' or email = '$LOGIN_EMAIL' order by email" || true
fi

echo "== T004: e-mail de confirmacao no coletor local =="
EMAIL="ci-$RANDOM$RANDOM@faro.test"
OUT="$(signup "$EMAIL" SenhaDeTeste12345 '{"name":"CI Teste","phone":"+5511987654421","terms_version":"2026-11"}')"
CODE="$(http_code "$OUT")"
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
fi
check "o coletor recebeu o e-mail de confirmacao" test -n "$MAIL_HTML"
check "o link contem /auth/confirmar-email?token_hash=" \
  bash -c 'printf "%s" "$1" | grep -q "/auth/confirmar-email?token_hash="' _ "$MAIL_HTML"
REP="$(signup "$EMAIL" OutraSenha12345)"
echo "cadastro repetido de e-mail AINDA NAO confirmado: HTTP $(http_code "$REP")"
check "o link contem type=email" \
  bash -c 'printf "%s" "$1" | grep -Eq "type=email"' _ "$MAIL_HTML"
check "o e-mail nao contem /auth/v1/verify (ConfirmationURL)" \
  bash -c '! printf "%s" "$1" | grep -q "/auth/v1/verify"' _ "$MAIL_HTML"

echo "== T021: CORS do login-guard =="
# No stack local, o Kong responde o preflight (OPTIONS) com 'Access-Control-Allow-Origin: *' ANTES de
# a funcao ser chamada; so no projeto hospedado o OPTIONS chega na funcao. Por isso a prova de que o
# CORS da funcao esta ativo e feita numa resposta de POST: os cabecalhos Allow-Headers e Allow-Methods
# abaixo so existem na resposta real da funcao (o Kong so os envia em preflight, com outro valor).
cat > supabase/.env.local <<'ENVEOF'
HASH_SALT=ci-test-salt-0123456789
ALLOWED_ORIGINS=http://localhost:4200
FARO_ENV=test
ENVEOF
supabase functions serve --env-file supabase/.env.local > /tmp/functions-serve.log 2>&1 &
SERVE_PID=$!
trap 'kill $SERVE_PID 2>/dev/null || true; rm -f supabase/.env.local' EXIT

post_guard() { # post_guard <origem>
  curl -s -i -X POST "$API_URL/functions/v1/login-guard" -H "Origin: $1" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"phase":"pre_attempt","email":"ci-sem-conta@faro.test"}' 2>/dev/null | tr -d '\r'
}
POST=""
for _ in $(seq 1 60); do
  POST="$(post_guard http://localhost:4200 || true)"
  if printf '%s' "$POST" | head -1 | grep -q ' 200'; then break; fi
  sleep 2
done
echo "POST pre_attempt (status e cabecalhos de CORS):"
printf '%s\n' "$POST" | grep -iE '^(HTTP/|access-control-|vary:)' || true
printf '%s\n' "$POST" | tail -1
check "POST ao login-guard responde 200 com a decisao (allow)" \
  bash -c 'printf "%s" "$1" | head -1 | grep -q " 200" && printf "%s" "$1" | grep -q "\"decision\":\"allow\""' _ "$POST"
check "a resposta traz o Allow-Headers da funcao (authorization, x-client-info, apikey, content-type)" \
  bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-headers: authorization, x-client-info, apikey, content-type$"' _ "$POST"
check "a resposta traz o Allow-Methods da funcao (POST, OPTIONS)" \
  bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-methods: POST, OPTIONS$"' _ "$POST"

PREFLIGHT="$(curl -s -i -X OPTIONS "$API_URL/functions/v1/login-guard" \
  -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,apikey" 2>/dev/null | tr -d '\r')"
echo "preflight local (respondido pelo Kong):"; printf '%s\n' "$PREFLIGHT" | grep -iE '^(HTTP/|access-control-)' || true
check "OPTIONS devolve 200 ou 204" bash -c 'printf "%s" "$1" | head -1 | grep -qE " (200|204)"' _ "$PREFLIGHT"

if [ "$FAILED" -ne 0 ]; then
  echo "--- ultimas linhas do supabase functions serve ---"
  tail -n 30 /tmp/functions-serve.log || true
  exit 1
fi
echo "Todas as conferencias passaram."
