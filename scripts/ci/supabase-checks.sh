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
if ! printf "%s" "$MAIL_HTML" | grep -q "/auth/confirmar-email?token_hash="; then
  echo "diagnostico: trecho do e-mail recebido (tokens ocultados):"
  printf "%s" "$MAIL_HTML" | grep -oE "(href=|https?://)[^ <>\"]{0,160}" | sed -E "s/(token|token_hash|code)=[A-Za-z0-9_.-]+/\1=<oculto>/g" | head -8
fi
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
code_only_in_sms_log() { # o codigo so aparece no registro [sms:log] (duas linhas: o texto e a linha "@dominio #codigo")
  if grep "$1" "$LOG_FILE" | grep -qF '[sms:log]' &&
    [ "$(grep "$1" "$LOG_FILE" | grep -vcE '\[sms:log\]|@tagfaro\.com\.br #')" = "0" ]; then
    return 0
  fi
  echo "linhas do log com o codigo (codigo ocultado):"
  grep "$1" "$LOG_FILE" | sed "s/$1/<codigo>/g" | cut -c1-200
  return 1
}
code_absent_from_tables() { # o codigo nao aparece como valor isolado nas tabelas (hashes hex tem 64 caracteres)
  local dump
  dump="$(rest GET 'phone_verifications?select=*')$(rest GET 'auth_audit_log?select=*')$(rest GET 'perfis?select=*')"
  # A leitura precisa ter funcionado (nao pode ser um erro vazio): a tabela traz a coluna code_hash.
  printf '%s' "$dump" | grep -qF '"code_hash"' &&
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
echo "start 1: $R"
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
echo "start 3 (usa o numero pendente): $R"
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
echo "troca com a senha certa: $R"
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
echo "auditoria do bloqueio: $A"
check "o bloqueio por limite de envio foi auditado (limite_envio)" has "$A" 'limite_envio'

# Preflight e CORS (no stack local o Kong responde o OPTIONS; a funcao prova o CORS na resposta do POST).
for f in login-guard phone-verify-start phone-verify-confirm; do
  OC="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" \
    -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type,apikey")"
  check "OPTIONS em $f devolve 204 ou 200 ($OC)" bash -c '[ "$1" = "204" ] || [ "$1" = "200" ]' _ "$OC"
done
for f in phone-verify-start phone-verify-confirm; do
  H="$(curl -s -i -X POST "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" -d '{"code":"12"}' | tr -d '\r')"
  # O Kong local acrescenta 'Allow-Origin: *' tambem nas respostas de POST; so Allow-Headers e Allow-Methods
  # (com o texto exato de _shared/http.ts) provam que o CORS e da funcao. A regra da origem tem teste em http.test.ts.
  echo "POST em $f (cabecalhos de CORS):"; printf '%s\n' "$H" | grep -iE '^(HTTP/|access-control-|vary:)' || true
  check "POST em $f traz o Allow-Headers da funcao" \
    bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-headers: authorization, x-client-info, apikey, content-type$"' _ "$H"
  check "POST em $f traz o Allow-Methods da funcao" \
    bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-methods: POST, OPTIONS$"' _ "$H"
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

echo "== T066 e T067: password-recovery =="
admin_create_user() { # admin_create_user <email> <senha>   (imprime o corpo; so no stack local do CI)
  curl -s -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"CI Conta\",\"terms_version\":\"2026-11\"}}"
}
mail_count() { # mail_count <email>: mensagens no coletor local para o destinatario
  curl -s "http://127.0.0.1:54324/api/v1/search?query=to:$1" | grep -oE '"ID":"[^"]+"' | wc -l | tr -d ' '
}
rec_call() { # rec_call <email>  => "<corpo>|<tempo total em segundos>"
  curl -s -w '|%{time_total}' -X POST "$API_URL/functions/v1/password-recovery" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" -H "Origin: http://localhost:4200" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"captcha_token\":null}"
}
ge() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a>=b)}'; }
near() { awk -v a="$1" -v b="$2" -v d="$3" 'BEGIN{x=a-b; if(x<0)x=-x; exit !(x<d)}'; }

if restart_serve "$PEPPER" test log; then pass "functions serve reiniciado para a recuperacao de senha"; else fail "functions serve nao subiu para a recuperacao de senha"; fi
REC_EXIST="ci-rec-$RANDOM$RANDOM@faro.test"
REC_MISSING="ci-rec-sem-conta-$RANDOM$RANDOM@faro.test"
admin_create_user "$REC_EXIST" "SenhaDeTeste12345" > /dev/null
rec_call "aquecimento-invalido" > /dev/null   # esquenta a funcao (partida a frio) sem gastar limite

R1="$(rec_call "$REC_EXIST")"; B1="${R1%|*}"; T1="${R1##*|}"
R2="$(rec_call "$REC_MISSING")"; B2="${R2%|*}"; T2="${R2##*|}"
echo "recuperacao, e-mail com conta: corpo $B1 em ${T1}s; sem conta: corpo $B2 em ${T2}s"
check "e-mail existente: corpo { ok: true }" test "$B1" = '{"ok":true}'
check "e-mail inexistente: o MESMO corpo" test "$B1" = "$B2"
check "e-mail existente: resposta so depois do piso de 0,6 s" ge "$T1" 0.6
check "e-mail inexistente: resposta so depois do piso de 0,6 s" ge "$T2" 0.6
check "os dois tempos ficam na mesma faixa (diferenca < 0,5 s)" near "$T1" "$T2" 0.5
RI="$(rec_call "isto-nao-e-um-email")"
check "e-mail invalido: o mesmo corpo, sem erro" test "${RI%|*}" = '{"ok":true}'
check "corpo que nao e objeto: 400 bad_request" test "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/functions/v1/password-recovery" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '[]')" = "400"
check "GET devolve 405" test "$(curl -s -o /dev/null -w '%{http_code}' -X GET "$API_URL/functions/v1/password-recovery" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")" = "405"

REC_MAIL=""
for _ in $(seq 1 20); do
  if [ "$(mail_count "$REC_EXIST")" -ge 1 ]; then break; fi
  sleep 1
done
check "o e-mail de recuperacao chegou ao coletor para a conta existente" test "$(mail_count "$REC_EXIST")" -ge 1
RID="$(curl -s "http://127.0.0.1:54324/api/v1/search?query=to:$REC_EXIST" | grep -oE '"ID":"[^"]+"' | head -1 | cut -d'"' -f4)"
if [ -n "$RID" ]; then REC_MAIL="$(curl -s "http://127.0.0.1:54324/api/v1/message/$RID")"; fi
check "o link de recuperacao contem /auth/nova-senha?token_hash=" \
  bash -c 'printf "%s" "$1" | grep -q "/auth/nova-senha?token_hash="' _ "$REC_MAIL"
check "o link de recuperacao contem type=recovery" bash -c 'printf "%s" "$1" | grep -q "type=recovery"' _ "$REC_MAIL"
check "nenhum e-mail para a conta inexistente" test "$(mail_count "$REC_MISSING")" = "0"

# Limite de 3 por hora por e-mail: os pedidos 2 e 3 passam; o 4o e negado em silencio.
rec_call "$REC_EXIST" > /dev/null
rec_call "$REC_EXIST" > /dev/null
sleep 6
N_ANTES="$(mail_count "$REC_EXIST")"
R4="$(rec_call "$REC_EXIST")"
echo "4o pedido para o mesmo e-mail: corpo ${R4%|*} em ${R4##*|}s"
check "4o pedido na hora: a mesma resposta { ok: true }" test "${R4%|*}" = '{"ok":true}'
sleep 6
check "4o pedido na hora: NENHUM e-mail novo no coletor" test "$(mail_count "$REC_EXIST")" = "$N_ANTES"
A="$(rest GET "auth_audit_log?evento=eq.senha_recuperacao_solicitada&detalhe-%3E%3Epermitido=eq.false&select=detalhe")"
echo "pedidos negados na auditoria: $(printf '%s' "$A" | grep -o 'permitido' | wc -l | tr -d ' ')"
check "o 4o pedido foi auditado com permitido = false (origem pedido)" bash -c 'printf "%s" "$1" | grep -q "pedido" && printf "%s" "$1" | grep -q "permitido"' _ "$A"
A="$(rest GET "auth_audit_log?evento=eq.senha_recuperacao_solicitada&detalhe-%3E%3Epermitido=eq.true&select=detalhe")"
check "os pedidos permitidos tambem foram auditados" bash -c 'printf "%s" "$1" | grep -q "permitido"' _ "$A"
DUMP="$(rest GET 'auth_audit_log?select=*')"
check "a leitura da auditoria funcionou (traz a coluna ip_hash)" has "$DUMP" '"ip_hash"'
check "nenhum e-mail dos pedidos na auditoria" bash -c '! printf "%s" "$1" | grep -qF -e "$2" -e "$3"' _ "$DUMP" "$REC_EXIST" "$REC_MISSING"
check "nenhum e-mail dos pedidos no log da funcao" bash -c '! grep -qF -e "$1" -e "$2" "$3"' _ "$REC_EXIST" "$REC_MISSING" "$LOG_FILE"

echo "== T076 e T077: account-delete =="
DEL_PASS="SenhaDeTeste12345"
mk_del_user() { # mk_del_user <var-email> <var-id> <var-token>  (cria, entra e le o id e o token)
  local email="ci-del-$RANDOM$RANDOM@faro.test" body tok id
  body="$(admin_create_user "$email" "$DEL_PASS")"
  id="$(printf '%s' "$body" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)"
  tok="$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$DEL_PASS\"}" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
  printf -v "$1" '%s' "$email"; printf -v "$2" '%s' "$id"; printf -v "$3" '%s' "$tok"
}
admin_user_status() { curl -s -o /dev/null -w '%{http_code}' "$API_URL/auth/v1/admin/users/$1" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"; }

mk_del_user D1_EMAIL D1_ID D1_TOKEN
check "usuario de exclusao 1 criado e autenticado" test -n "$D1_ID" -a -n "$D1_TOKEN"
check "sem usuario valido (chave anonima): 401" test "$(fn_code account-delete '{"confirm":"EXCLUIR"}' "$ANON_KEY")" = "401"
check "GET devolve 405" test "$(curl -s -o /dev/null -w '%{http_code}' -X GET "$API_URL/functions/v1/account-delete" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $D1_TOKEN")" = "405"
check "corpo que nao e objeto: 400" test "$(fn_code account-delete '[]' "$D1_TOKEN")" = "400"
R="$(fn account-delete '{"confirm":"excluir","password":"SenhaDeTeste12345"}' "$D1_TOKEN")"
check "confirm diferente de EXCLUIR: confirmation_required" has "$R" '{"ok":false,"error":"confirmation_required"}'
R="$(fn account-delete '{"confirm":"EXCLUIR"}' "$D1_TOKEN")"
check "sem senha (conta com senha): reauth_required com method password" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"reauth_required\"" && printf "%s" "$1" | grep -qF "\"method\":\"password\""' _ "$R"
R="$(fn account-delete '{"confirm":"EXCLUIR","password":"SenhaErrada123"}' "$D1_TOKEN")"
check "senha errada: invalid_password" has "$R" '{"ok":false,"error":"invalid_password"}'
check "senha errada: o usuario continua existindo" test "$(admin_user_status "$D1_ID")" = "200"
check "senha errada: o perfil continua existindo" has "$(rest GET "perfis?id=eq.$D1_ID&select=id")" "$D1_ID"
check "a falha de reautenticacao foi auditada (excluir_conta)" has "$(rest GET "auth_audit_log?ator=eq.$D1_ID&evento=eq.reautenticacao_falha&select=detalhe")" 'excluir_conta'
# Limite: 5 provas falhas em 15 min => rate_limited (as 5 sao gravadas direto, sem gastar o limite de login do Auth).
rest POST "rate_limit_events" "[{\"bucket\":\"reauth:account\",\"key\":\"$D1_ID\"},{\"bucket\":\"reauth:account\",\"key\":\"$D1_ID\"},{\"bucket\":\"reauth:account\",\"key\":\"$D1_ID\"},{\"bucket\":\"reauth:account\",\"key\":\"$D1_ID\"},{\"bucket\":\"reauth:account\",\"key\":\"$D1_ID\"}]" > /dev/null
R="$(fn account-delete '{"confirm":"EXCLUIR","password":"SenhaDeTeste12345"}' "$D1_TOKEN")"
check "5 erros em 15 min: rate_limited com retry_after_seconds (mesmo com a senha certa)" bash -c 'printf "%s" "$1" | grep -q "\"error\":\"rate_limited\"" && printf "%s" "$1" | grep -qE "\"retry_after_seconds\":[0-9]+"' _ "$R"
check "rate_limited: o usuario continua existindo" test "$(admin_user_status "$D1_ID")" = "200"
rest DELETE "rate_limit_events?key=eq.$D1_ID" > /dev/null

# Senha certa, sem o bucket de fotos (ou com ele vazio): exclui.
R="$(fn account-delete '{"confirm":"EXCLUIR","password":"SenhaDeTeste12345"}' "$D1_TOKEN")"
echo "exclusao 1: $R"
check "senha certa: { ok: true }" has "$R" '{"ok":true}'
check "o usuario sumiu de auth.users" test "$(admin_user_status "$D1_ID")" = "404"
check "o perfil sumiu" test "$(rest GET "perfis?id=eq.$D1_ID&select=id")" = "[]"
A="$(rest GET "auth_audit_log?evento=eq.conta_excluida&ator=is.null&select=detalhe,ip_hash")"
check "existe um evento conta_excluida com ator nulo e vinculos_encerrados 0" bash -c 'printf "%s" "$1" | grep -q "vinculos_encerrados" && printf "%s" "$1" | grep -qE "\"vinculos_encerrados\": ?0"' _ "$A"
check "os eventos da conta continuam, sem identificacao (ator nulo)" has "$(rest GET "auth_audit_log?ator=is.null&evento=eq.reautenticacao_falha&select=detalhe")" 'excluir_conta'
check "o token antigo deixa de valer (401)" test "$(fn_code account-delete '{"confirm":"EXCLUIR","password":"SenhaDeTeste12345"}' "$D1_TOKEN")" = "401"
SU="$(signup "$D1_EMAIL" "$DEL_PASS")"
check "o mesmo e-mail consegue se cadastrar de novo (200)" test "$(http_code "$SU")" = "200"

# Segunda conta: com fotos no bucket pet-photos sob <uid>/. O CLI do CI nao traz a spec 003, entao o bucket e criado aqui.
curl -s -o /dev/null -X POST "$API_URL/storage/v1/bucket" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" -d '{"id":"pet-photos","name":"pet-photos","public":false}' || true
mk_del_user D2_EMAIL D2_ID D2_TOKEN
check "usuario de exclusao 2 criado e autenticado" test -n "$D2_ID" -a -n "$D2_TOKEN"
for f in foto-1.txt foto-2.txt; do
  curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/$f" -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: text/plain" --data-binary 'x'
done
curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/pasta/foto-3.txt" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: text/plain" --data-binary 'x'
OTHER_ID="00000000-0000-0000-0000-00000000aaaa"
curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$OTHER_ID/de-outro.txt" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: text/plain" --data-binary 'x'
storage_list() { # storage_list <prefixo>
  curl -s -X POST "$API_URL/storage/v1/object/list/pet-photos" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" -d "{\"prefix\":\"$1\",\"limit\":100,\"offset\":0}"
}
check "as fotos da conta 2 existem antes da exclusao" has "$(storage_list "$D2_ID")" 'foto-1.txt'
R="$(fn account-delete '{"confirm":"EXCLUIR","password":"SenhaDeTeste12345"}' "$D2_TOKEN")"
echo "exclusao 2: $R"
check "conta com fotos: { ok: true }" has "$R" '{"ok":true}'
check "as fotos da conta (e da subpasta) foram removidas" bash -c '! printf "%s" "$1" | grep -q "foto-"' _ "$(storage_list "$D2_ID")"
check "a foto da subpasta tambem sumiu" bash -c '! printf "%s" "$1" | grep -q "foto-3"' _ "$(storage_list "$D2_ID/pasta")"
check "a foto de OUTRA conta nao foi tocada" has "$(storage_list "$OTHER_ID")" 'de-outro.txt'
check "o usuario 2 sumiu de auth.users" test "$(admin_user_status "$D2_ID")" = "404"

for f in password-recovery account-delete; do
  OC="$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" \
    -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type,apikey")"
  check "OPTIONS em $f devolve 204 ou 200 ($OC)" bash -c '[ "$1" = "204" ] || [ "$1" = "200" ]' _ "$OC"
  H="$(curl -s -i -X POST "$API_URL/functions/v1/$f" -H "Origin: http://localhost:4200" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '[]' | tr -d '\r')"
  check "POST em $f traz o Allow-Headers da funcao" \
    bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-headers: authorization, x-client-info, apikey, content-type$"' _ "$H"
  check "POST em $f traz o Allow-Methods da funcao" \
    bash -c 'printf "%s" "$1" | grep -qi "^access-control-allow-methods: POST, OPTIONS$"' _ "$H"
done
if restart_serve - test log; then
  C="$(fn_code account-delete '{"confirm":"EXCLUIR"}' "$ANON_KEY")"
  check "sem o pepper a exclusao de conta nao depende dele (a chave anonima segue 401)" test "$C" = "401"
else fail "functions serve nao subiu sem pepper (exclusao e recuperacao)"; fi
C="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/functions/v1/password-recovery" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"email":"x@y.zz"}')"
check "sem PHONE_OTP_PEPPER a recuperacao de senha continua funcionando (200)" test "$C" = "200"

echo "== T098 a T100: corpo, chaves, metodos e limites nas Edge Functions =="
if restart_serve "$PEPPER" test log; then pass "functions serve reiniciado com o pepper para as conferencias de corpo"; else fail "functions serve nao subiu para as conferencias de corpo"; fi
BIG="$(head -c 5000 /dev/zero | tr '\0' 'x')"
post_code() { # post_code <funcao> <json> [token]  (so o codigo HTTP; chave anonima por padrao)
  curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/functions/v1/$1" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer ${3:-$ANON_KEY}" -H "Content-Type: application/json" -d "$2"
}
check "password-recovery: corpo de 5 KB => 413" test "$(post_code password-recovery "{\"email\":\"$BIG@x.zz\"}")" = "413"
check "password-recovery: chave desconhecida => 400" test "$(post_code password-recovery '{"email":"x@y.zz","redirectTo":"https://evil.example"}')" = "400"
check "login-guard: corpo de 5 KB => 413" test "$(post_code login-guard "{\"phase\":\"pre_attempt\",\"email\":\"$BIG@x.zz\"}")" = "413"
check "login-guard: chave desconhecida => 400" test "$(post_code login-guard '{"phase":"pre_attempt","email":"x@y.zz","role":"admin"}')" = "400"
check "login-guard: PUT => 405" test "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$API_URL/functions/v1/login-guard" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")" = "405"
check "phone-verify-confirm: chave desconhecida => 400" test "$(post_code phone-verify-confirm '{"code":"123456","x":1}' "$TOKEN_B")" = "400"
check "phone-verify-start: chave desconhecida => 400" test "$(post_code phone-verify-start '{"phone":"(11) 98765-4421","x":1}' "$TOKEN_B")" = "400"
check "phone-verify-start: captcha_token de 3000 caracteres => 400" \
  test "$(post_code phone-verify-start "{\"captcha_token\":\"$(head -c 3000 /dev/zero | tr '\0' 't')\"}" "$TOKEN_B")" = "400"
check "account-delete: chave desconhecida => 400" test "$(post_code account-delete '{"confirm":"EXCLUIR","x":1}' "$TOKEN_B")" = "400"
GUARD_BODY="{\"phase\":\"post_result\",\"email\":\"ci-guard@faro.test\",\"success\":true,\"user_id\":\"$UID_B\",\"detail\":{\"metodo\":\"password\",\"email\":\"vazou@faro.test\"}}"
check "login-guard: post_result com user_id e detail sujo responde 200" test "$(post_code login-guard "$GUARD_BODY")" = "200"
GA="$(rest GET 'auth_audit_log?evento=eq.login_sucesso&select=ator,detalhe')"
check "a leitura da auditoria funcionou" has "$GA" '"detalhe"'
check "login-guard ignorou o user_id do corpo (nenhum ator = tutor B)" bash -c '! printf "%s" "$1" | grep -qF "$2"' _ "$GA" "$UID_B"
check "login-guard descartou o e-mail do detail" bash -c '! printf "%s" "$1" | grep -qF "vazou@faro.test"' _ "$GA"
check "login-guard manteve a chave metodo do detail" has "$GA" 'password'

echo "== T101: configuracao do Auth (rotacao de refresh token, sem entrada anonima) =="
AN="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}')"
echo "entrada anonima (signup sem e-mail): HTTP $(http_code "$AN"); $(http_body "$AN" | grep -oE '"error_code":"[^"]*"' | head -1)"
check "entrada anonima desligada (anonymous_provider_disabled)" bash -c 'printf "%s" "$1" | grep -q "anonymous_provider_disabled"' _ "$(http_body "$AN")"
RL="$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"SenhaDeTeste12345\"}")"
RT0="$(printf '%s' "$RL" | grep -oE '"refresh_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
check "login devolve refresh_token" test -n "$RT0"
RF1="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=refresh_token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$RT0\"}")"
check "a primeira renovacao do refresh_token funciona (200)" test "$(http_code "$RF1")" = "200"
sleep 12
RF2="$(curl -s -w '\n%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=refresh_token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$RT0\"}")"
echo "reuso do refresh_token antigo depois do intervalo de 10 s: HTTP $(http_code "$RF2"); $(http_body "$RF2" | grep -oE '"error_code":"[^"]*"' | head -1)"
check "reuso do refresh_token antigo depois de 10 s e recusado (rotacao ligada)" bash -c '[ "$1" != "200" ]' _ "$(http_code "$RF2")"

echo "== T097: endurecimento de base (migration 0017) pela API =="
AC="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/rest/v1/perfis?select=id" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")"
echo "anon lendo perfis pela API: HTTP $AC"
check "anon lendo perfis recebe 401 ou 403 (sem privilegio), nao 200 com lista vazia" bash -c '[ "$1" = "401" ] || [ "$1" = "403" ]' _ "$AC"
AB="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/rest/v1/rpc/rate_limit_check" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"p_checks":[]}')"
check "anon chamando rate_limit_check recebe 401 ou 403 ($AB)" bash -c '[ "$1" = "401" ] || [ "$1" = "403" ]' _ "$AB"
GQ="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/graphql/v1" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"query":"{__typename}"}')"
echo "GraphQL: HTTP $GQ"
check "o endpoint GraphQL nao responde 200" bash -c '[ "$1" != "200" ]' _ "$GQ"

echo "== T099: guard:ip:m (60 chamadas por minuto por IP) =="
FLOOD=0
for _ in $(seq 1 80); do
  FR="$(curl -s -X POST "$API_URL/functions/v1/login-guard" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" -d '{"phase":"pre_attempt","email":"ci-flood@faro.test"}')"
  if printf '%s' "$FR" | grep -q '"decision":"backoff"'; then FLOOD=1; break; fi
done
check "login-guard responde backoff depois de 60 chamadas em um minuto do mesmo IP" test "$FLOOD" = "1"

if [ "$FAILED" -ne 0 ]; then
  echo "--- ultimas linhas do supabase functions serve ---"
  tail -n 30 /tmp/functions-serve.log || true
  exit 1
fi
echo "Todas as conferencias passaram."
