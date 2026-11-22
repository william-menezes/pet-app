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

echo "== Seed: os tres usuarios entram por senha e current_user_role devolve o papel certo =="
seed_login() { # seed_login <email> <papel esperado>
  local out code body token role
  out="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"TesteSenha123!\"}")"
  code="$(http_code "$out")"; body="$(http_body "$out")"
  token="$(printf '%s' "$body" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
  role=""
  if [ -n "$token" ]; then
    role="$(curl -s -X POST "$API_URL/rest/v1/rpc/current_user_role" -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{}' | tr -d '"')"
  fi
  echo "$1: login HTTP $code; papel: $role"
  check "login por senha de $1 devolve 200" test "$code" = "200"
  check "current_user_role de $1 devolve $2" test "$role" = "$2"
}
seed_login tutor.a@faro.test tutor
seed_login tutor.b@faro.test tutor
seed_login admin@faro.test admin

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
# Investigacao T003: o 422 muda se o usuario confirmou pelo fluxo normal (link do e-mail)?
TH="$(printf '%s' "$MAIL_HTML" | grep -oE 'token_hash=[A-Za-z0-9_-]+' | head -1 | cut -d= -f2)"
if [ -n "$TH" ]; then
  VC="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/auth/v1/verify" -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" -d "{\"type\":\"email\",\"token_hash\":\"$TH\"}")"
  echo "confirmacao pelo link (verify): HTTP $VC"
  REP2="$(signup "$EMAIL" OutraSenha12345)"
  echo "cadastro repetido de e-mail confirmado pelo fluxo normal: HTTP $(http_code "$REP2"); $(http_body "$REP2" | grep -oE '"error_code":"[^"]*"' | head -1)"
fi

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

echo "== T051 a T053: phone-verify-start e phone-verify-confirm (SMS_DRIVER=log, FARO_ENV=test) =="
# Valores de teste descartaveis do stack local do CI. O pepper tem 32+ caracteres (exigencia de loadEnv).
PEPPER="ci-test-pepper-0123456789-0123456789-abcdef"
LOG_FILE=/tmp/functions-serve.log
write_env() { # write_env <pepper|-> <FARO_ENV|-> <SMS_DRIVER|->   ("-" omite a variavel)
  {
    echo "HASH_SALT=ci-test-salt-0123456789"
    echo "ALLOWED_ORIGINS=http://localhost:4200"
    echo "SITE_URL=http://localhost:4200"
    if [ "$1" != "-" ]; then echo "PHONE_OTP_PEPPER=$1"; fi
    if [ "$2" != "-" ]; then echo "FARO_ENV=$2"; fi
    if [ "$3" != "-" ]; then echo "SMS_DRIVER=$3"; fi
    if [ "$3" = "stub" ]; then echo "SMS_STUB_CODE=424242"; fi
  } > supabase/.env.local
}
restart_serve() { # restart_serve <pepper|-> <FARO_ENV|-> <SMS_DRIVER|->
  kill "$SERVE_PID" 2>/dev/null || true
  wait "$SERVE_PID" 2>/dev/null || true
  sleep 3
  write_env "$@"
  supabase functions serve --env-file supabase/.env.local > "$LOG_FILE" 2>&1 &
  SERVE_PID=$!
  local r
  for _ in $(seq 1 60); do
    r="$(curl -s -X POST "$API_URL/functions/v1/phone-verify-confirm" -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{}' || true)"
    if printf '%s' "$r" | grep -q '"ok":false'; then return 0; fi
    sleep 2
  done
  return 1
}
fn() { # fn <funcao> <json> [token]   (corpo da resposta; sempre com a origem permitida)
  curl -s -X POST "$API_URL/functions/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer ${3:-$TOKEN_B}" \
    -H "Origin: http://localhost:4200" -H "Content-Type: application/json" -d "$2"
}
fn_code() { # fn_code <funcao> <json> [token]   (so o codigo HTTP)
  curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/functions/v1/$1" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer ${3:-$TOKEN_B}" -H "Content-Type: application/json" -d "$2"
}
has() { printf '%s' "$1" | grep -qF -- "$2"; }
rest() { # rest <metodo> <caminho> [corpo]   (service_role, so no stack local do CI)
  local m="$1" p="$2" extra=()
  shift 2
  if [ $# -gt 0 ]; then extra=(-d "$1"); fi
  curl -s -X "$m" "$API_URL/rest/v1/$p" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" "${extra[@]}"
}
PREV_CODE=""
last_code() { # imprime o codigo mais recente da linha [sms:log] do terminal da funcao
  local c
  for _ in $(seq 1 15); do
    c="$(grep -o 'seu codigo e [0-9]\{6\}' "$LOG_FILE" | tail -1 | grep -o '[0-9]\{6\}')"
    if [ -n "$c" ] && [ "$c" != "$PREV_CODE" ]; then printf '%s' "$c"; return 0; fi
    sleep 1
  done
  return 1
}
code_only_in_sms_log() { # o codigo aparece em UMA linha do log: a [sms:log]
  [ "$(grep -c "$1" "$LOG_FILE")" = "1" ] && grep "$1" "$LOG_FILE" | grep -qF '[sms:log]'
}
code_absent_from_tables() { # o codigo nao aparece como valor isolado nas tabelas (hashes hex tem 64 caracteres)
  local dump
  dump="$(rest GET 'phone_verifications?select=*')$(rest GET 'auth_audit_log?select=*')$(rest GET 'perfis?select=*')"
  ! printf '%s' "$dump" | grep -qE "(^|[^0-9a-f])$1([^0-9a-f]|\$)"
}

if restart_serve "$PEPPER" test log; then pass "functions serve subiu com pepper, FARO_ENV=test e SMS_DRIVER=log"; else fail "functions serve nao subiu"; fi

TB="$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"tutor.b@faro.test","password":"TesteSenha123!"}')"
TOKEN_B="$(printf '%s' "$TB" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
UID_B="$(curl -s "$API_URL/auth/v1/user" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_B" \
  | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)"
check "login do tutor B (token e id lidos)" test -n "$TOKEN_B" -a -n "$UID_B"

# Sem usuario valido: 401 unauthorized nas duas funcoes.
for f in phone-verify-start phone-verify-confirm; do
  check "$f com a chave anonima responde 401" test "$(fn_code "$f" '{}' "$ANON_KEY")" = "401"
  check "$f com a chave anonima devolve unauthorized" has "$(fn "$f" '{}' "$ANON_KEY")" '"error":"unauthorized"'
done
check "GET devolve 405 method_not_allowed" test \
  "$(curl -s -o /dev/null -w '%{http_code}' -X GET "$API_URL/functions/v1/phone-verify-start" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_B")" = "405"

R="$(fn phone-verify-start '{"phone":"(11) 98765-4421"}')"
echo "start sem aceite: $R"
check "sem aceite dos termos: terms_required" has "$R" '"error":"terms_required"'
curl -s -o /dev/null -w 'accept_terms: HTTP %{http_code}\n' -X POST "$API_URL/rest/v1/rpc/accept_terms" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"p_versao":"2026-11"}'

R="$(fn phone-verify-start '{"phone":"(11) 98765-4421"}')"
echo "start 1: $(printf '%s' "$R" | sed -E 's/[0-9]{6}/<seis digitos>/g')"
check "start devolve ok e o telefone da propria conta" bash -c 'printf "%s" "$1" | grep -q "\"ok\":true" && printf "%s" "$1" | grep -qF "\"phone\":\"+5511987654421\""' _ "$R"
check "start devolve attempts_left 5" has "$R" '"attempts_left":5'
CODE1="$(last_code || true)"; PREV_CODE="$CODE1"
check "o codigo aparece no terminal na linha [sms:log] (para=4421)" test -n "$CODE1"
check "o codigo nao esta na resposta do start" bash -c '! printf "%s" "$1" | grep -qF "$2"' _ "$R" "$CODE1"
check "o codigo aparece so na linha [sms:log] do log" code_only_in_sms_log "$CODE1"

R="$(fn phone-verify-start '{"phone":"(11) 98765-4421"}')"
echo "start 2 (imediato): $R"
check "segundo envio em menos de 60 s: cooldown com retry_after_seconds" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"cooldown\"" && printf "%s" "$1" | grep -qE "\"retry_after_seconds\":[0-9]+"' _ "$R"
R="$(fn phone-verify-start '{"phone":"(11) 3765-4421"}')"
check "numero fixo: invalid_phone" has "$R" '"error":"invalid_phone"'

WRONG="000000"; if [ "$CODE1" = "000000" ]; then WRONG="111111"; fi
R="$(fn phone-verify-confirm '{"code":"12"}')"
check "confirm com 2 digitos: invalid_format" has "$R" '"error":"invalid_format"'
for left in 4 3 2 1; do
  R="$(fn phone-verify-confirm "{\"code\":\"$WRONG\"}")"
  echo "confirm errado: $R"
  check "codigo errado: invalid_code com attempts_left $left" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"invalid_code\"" && printf "%s" "$1" | grep -qF "\"attempts_left\":$2"' _ "$R" "$left"
done
R="$(fn phone-verify-confirm "{\"code\":\"$WRONG\"}")"
check "5o erro: locked" has "$R" '"error":"locked"'
R="$(fn phone-verify-confirm "{\"code\":\"$CODE1\"}")"
check "depois do bloqueio, o codigo certo: no_active" has "$R" '"error":"no_active"'

# Novo envio (limpa o intervalo de 60 s) e acerto.
rest DELETE "rate_limit_events?bucket=eq.sms:cooldown" > /dev/null
R="$(fn phone-verify-start '{}')"
echo "start 3 (usa o numero pendente): $(printf '%s' "$R" | sed -E 's/[0-9]{6}/<seis digitos>/g')"
check "sem phone no corpo, usa o numero pendente" has "$R" '"phone":"+5511987654421"'
CODE2="$(last_code || true)"; PREV_CODE="$CODE2"
R="$(fn phone-verify-confirm "{\"code\":\"$CODE2\"}")"
echo "confirm certo: $R"
check "codigo certo: ok com o telefone" bash -c 'printf "%s" "$1" | grep -q "\"ok\":true" && printf "%s" "$1" | grep -qF "\"phone\":\"+5511987654421\""' _ "$R"
P="$(rest GET "perfis?id=eq.$UID_B&select=celular,celular_pendente")"
echo "perfil apos o acerto: $P"
check "perfis.celular = numero e celular_pendente nulo" bash -c 'printf "%s" "$1" | grep -qF "\"celular\":\"+5511987654421\"" && printf "%s" "$1" | grep -qF "\"celular_pendente\":null"' _ "$P"
PC="$(curl -s -X POST "$API_URL/rest/v1/rpc/phone_is_confirmed" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" -d "{\"p_user_id\":\"$UID_B\"}")"
check "phone_is_confirmed da propria conta devolve true" test "$PC" = "true"
check "codigo 1 continua so na linha [sms:log] depois das conferencias" code_only_in_sms_log "$CODE1"
check "codigo 2 so na linha [sms:log]" code_only_in_sms_log "$CODE2"
check "codigo 1 fora das tabelas" code_absent_from_tables "$CODE1"
check "codigo 2 fora das tabelas" code_absent_from_tables "$CODE2"

# Troca: o celular ja esta confirmado, entao pede nova prova de identidade (senha).
R="$(fn phone-verify-start '{"phone":"(21) 98888-7777"}')"
check "troca sem senha: reauth_required com method password" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"reauth_required\"" && printf "%s" "$1" | grep -qF "\"method\":\"password\""' _ "$R"
R="$(fn phone-verify-start '{"phone":"(21) 98888-7777","password":"SenhaErrada123"}')"
check "troca com senha errada: invalid_password" has "$R" '"error":"invalid_password"'
rest DELETE "rate_limit_events?bucket=eq.sms:cooldown" > /dev/null
R="$(fn phone-verify-start '{"phone":"(21) 98888-7777","password":"TesteSenha123!"}')"
echo "troca com a senha certa: $(printf '%s' "$R" | sed -E 's/[0-9]{6}/<seis digitos>/g')"
check "troca com a senha certa: ok" bash -c 'printf "%s" "$1" | grep -q "\"ok\":true" && printf "%s" "$1" | grep -qF "\"phone\":\"+5521988887777\""' _ "$R"
P="$(rest GET "perfis?id=eq.$UID_B&select=celular,celular_pendente")"
check "troca: o celular antigo permanece e o novo fica pendente" bash -c 'printf "%s" "$1" | grep -qF "\"celular\":\"+5511987654421\"" && printf "%s" "$1" | grep -qF "\"celular_pendente\":\"+5521988887777\""' _ "$P"
SAME="$(fn phone-verify-start '{"phone":"(11) 98765-4421"}')"
check "numero igual ao ja confirmado: same_number" has "$SAME" '"error":"same_number"'

# Limite por hora (5): grava 5 eventos como se ja tivessem sido enviados e tenta de novo.
rest DELETE "rate_limit_events?bucket=eq.sms:cooldown" > /dev/null
rest POST "rate_limit_events" "[{\"bucket\":\"sms:account:h\",\"key\":\"$UID_B\"},{\"bucket\":\"sms:account:h\",\"key\":\"$UID_B\"},{\"bucket\":\"sms:account:h\",\"key\":\"$UID_B\"},{\"bucket\":\"sms:account:h\",\"key\":\"$UID_B\"},{\"bucket\":\"sms:account:h\",\"key\":\"$UID_B\"}]" > /dev/null
R="$(fn phone-verify-start '{"phone":"(21) 98888-7777","password":"TesteSenha123!"}')"
echo "start no limite por hora: $R"
check "6o envio na hora: rate_limited com retry_after_seconds" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"rate_limited\"" && printf "%s" "$1" | grep -qE "\"retry_after_seconds\":[0-9]+"' _ "$R"
A="$(rest GET "auth_audit_log?ator=eq.$UID_B&evento=eq.celular_bloqueado&select=detalhe")"
check "o bloqueio por limite de envio foi auditado (limite_envio)" has "$A" '"motivo":"limite_envio"'

# Preflight e CORS (no stack local o Kong responde o OPTIONS; a funcao prova o CORS na resposta do POST).
for f in login-guard phone-verify-start phone-verify-confirm; do
  OC="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" \
    -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type,apikey")"
  check "OPTIONS em $f devolve 204 ou 200 ($OC)" bash -c '[ "$1" = "204" ] || [ "$1" = "200" ]' _ "$OC"
done
for f in phone-verify-start phone-verify-confirm; do
  H="$(curl -s -i -X POST "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"code":"12"}' | tr -d '\r')"
  check "POST em $f traz Allow-Origin da funcao (http://localhost:4200)" \
    bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-origin: http://localhost:4200$"' _ "$H"
  H2="$(curl -s -i -X POST "$API_URL/functions/v1/$f" -H "Origin: https://evil.example" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"code":"12"}' | tr -d '\r')"
  check "POST em $f com origem fora da lista nao recebe Allow-Origin da funcao" \
    bash -c '! printf "%s" "$1" | grep -qi "^access-control-allow-origin: https://evil.example"' _ "$H2"
done

# Tabela "Falha fechada" de quickstart.md §6. Cada linha reinicia o functions serve com o ambiente alterado.
if restart_serve - test log; then
  R="$(fn phone-verify-start '{"phone":"(31) 97777-6666"}')"; C="$(fn_code phone-verify-start '{"phone":"(31) 97777-6666"}')"
  check "sem PHONE_OTP_PEPPER: HTTP 500 misconfigured" bash -c '[ "$1" = "500" ] && printf "%s" "$2" | grep -q "\"error\":\"misconfigured\""' _ "$C" "$R"
  C="$(fn_code phone-verify-confirm '{"code":"123456"}')"
  check "sem PHONE_OTP_PEPPER: a funcao de confirmacao tambem responde 500" test "$C" = "500"
else fail "functions serve nao subiu sem pepper"; fi
if restart_serve curto test log; then
  R="$(fn phone-verify-start '{"phone":"(31) 97777-6666"}')"; C="$(fn_code phone-verify-start '{"phone":"(31) 97777-6666"}')"
  check "PHONE_OTP_PEPPER curto: HTTP 500 misconfigured" bash -c '[ "$1" = "500" ] && printf "%s" "$2" | grep -q "\"error\":\"misconfigured\""' _ "$C" "$R"
else fail "functions serve nao subiu com pepper curto"; fi
if restart_serve "$PEPPER" production stub; then
  R="$(fn phone-verify-start '{"phone":"(31) 97777-6666"}')"
  check "FARO_ENV=production com SMS_DRIVER=stub: sms_unavailable" has "$R" '{"ok":false,"error":"sms_unavailable"}'
else fail "functions serve nao subiu com production e stub"; fi
if restart_serve "$PEPPER" - log; then
  R="$(fn phone-verify-start '{"phone":"(31) 97777-6666"}')"
  check "sem FARO_ENV com SMS_DRIVER=log: sms_unavailable" has "$R" '{"ok":false,"error":"sms_unavailable"}'
else fail "functions serve nao subiu sem FARO_ENV"; fi
if restart_serve "$PEPPER" test -; then
  R="$(fn phone-verify-start '{"phone":"(31) 97777-6666"}')"
  check "sem SMS_DRIVER: sms_unavailable" has "$R" '{"ok":false,"error":"sms_unavailable"}'
else fail "functions serve nao subiu sem SMS_DRIVER"; fi

# Driver stub em FARO_ENV=test: o codigo e o fixo (SMS_STUB_CODE) e nada vai ao log.
if restart_serve "$PEPPER" test stub; then
  rest DELETE "rate_limit_events?key=eq.$UID_B" > /dev/null
  R="$(fn phone-verify-start '{"phone":"(21) 98888-7777","password":"TesteSenha123!"}')"
  check "stub em FARO_ENV=test envia sem escrever o codigo no log" bash -c 'printf "%s" "$1" | grep -q "\"ok\":true" && ! grep -q "seu codigo" "$2"' _ "$R" "$LOG_FILE"
  R="$(fn phone-verify-confirm '{"code":"424242"}')"
  check "stub: o codigo fixo 424242 confirma" has "$R" '"phone":"+5521988887777"'
else fail "functions serve nao subiu com o driver stub"; fi

if [ "$FAILED" -ne 0 ]; then
  echo "--- ultimas linhas do supabase functions serve ---"
  tail -n 30 /tmp/functions-serve.log || true
  exit 1
fi
echo "Todas as conferencias passaram."
