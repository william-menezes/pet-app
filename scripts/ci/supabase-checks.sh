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

echo "== Aquecimento: o Auth do stack recem-subido pode responder com o modelo padrao de e-mail =="
# Em alguns runs (2 de 9 na Phase 10) o primeiro e-mail saiu com o link padrao do Supabase (/auth/v1/verify) e nao com o
# modelo do repositorio, e o run seguinte, com o mesmo codigo, passou. Antes da conferencia T004, espera ate o Auth
# entregar o modelo do repositorio (ate 6 tentativas, 10 s entre elas) e IMPRIME quantas foram necessarias.
WARM_OK=0
for attempt in 1 2 3 4 5 6; do
  WARM_EMAIL="ci-warm-$RANDOM$RANDOM@faro.test"
  signup "$WARM_EMAIL" SenhaDeTeste12345 '{"name":"CI Aquecimento","terms_version":"2026-11"}' > /dev/null
  WARM_HTML=""
  for _ in $(seq 1 10); do
    WID="$(curl -s "http://127.0.0.1:54324/api/v1/search?query=to:$WARM_EMAIL" | grep -oE '"ID":"[^"]+"' | head -1 | cut -d'"' -f4)"
    if [ -n "$WID" ]; then WARM_HTML="$(curl -s "http://127.0.0.1:54324/api/v1/message/$WID")"; break; fi
    sleep 1
  done
  if printf '%s' "$WARM_HTML" | grep -q "/auth/confirmar-email?token_hash="; then WARM_OK=1; break; fi
  echo "aquecimento: tentativa $attempt sem o modelo do repositorio; aguardando"
  sleep 10
done
echo "aquecimento: modelo do repositorio visto na tentativa $attempt (WARM_OK=$WARM_OK)"

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
# Chave do servidor SSR do app (resolve-tag e register-scan, spec 003): 32+ caracteres, descartavel, so do stack local do CI.
SSR_KEY="ci-ssr-key-0123456789-0123456789-abcdef"
LOG_FILE=/tmp/functions-serve.log
write_env() { # write_env <pepper|-> <FARO_ENV|-> <SMS_DRIVER|->   ("-" omite a variavel)
  {
    echo "HASH_SALT=ci-test-salt-0123456789"
    echo "FARO_SSR_KEY=$SSR_KEY"
    echo "EMAIL_DRIVER=log"
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

# Segunda conta: com fotos no bucket pet-photos sob <uid>/. A migration 0032 ja cria o bucket (com os limites da 0035); a chamada abaixo e idempotente e so cobre um banco sem a spec 003.
curl -s -o /dev/null -X POST "$API_URL/storage/v1/bucket" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" -d '{"id":"pet-photos","name":"pet-photos","public":false}' || true
mk_del_user D2_EMAIL D2_ID D2_TOKEN
check "usuario de exclusao 2 criado e autenticado" test -n "$D2_ID" -a -n "$D2_TOKEN"
for f in foto-1.png foto-2.png; do
  curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/$f" -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: image/png" --data-binary 'x'
done
curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/pasta/foto-3.png" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: image/png" --data-binary 'x'
OTHER_ID="00000000-0000-0000-0000-00000000aaaa"
curl -s -o /dev/null -X POST "$API_URL/storage/v1/object/pet-photos/$OTHER_ID/de-outro.png" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: image/png" --data-binary 'x'
# Limites do bucket (spec 003, contrato de endurecimento secao 4, migration 0035): 5 MB e so jpeg, png e webp.
BAD_TYPE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/tipo-errado.txt" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: text/plain" --data-binary 'x')"
check "bucket pet-photos recusa tipo fora de jpeg/png/webp (4xx)" bash -c '[ "$1" -ge 400 ] && [ "$1" -lt 500 ]' _ "$BAD_TYPE"
BIG_FILE="$(mktemp)"
head -c 6291456 /dev/zero > "$BIG_FILE"
BAD_SIZE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/storage/v1/object/pet-photos/$D2_ID/grande.png" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: image/png" --data-binary "@$BIG_FILE")"
rm -f "$BIG_FILE"
check "bucket pet-photos recusa arquivo de 6 MB (4xx)" bash -c '[ "$1" -ge 400 ] && [ "$1" -lt 500 ]' _ "$BAD_SIZE"
storage_list() { # storage_list <prefixo>
  curl -s -X POST "$API_URL/storage/v1/object/list/pet-photos" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" -d "{\"prefix\":\"$1\",\"limit\":100,\"offset\":0}"
}
check "as fotos da conta 2 existem antes da exclusao" has "$(storage_list "$D2_ID")" 'foto-1.png'
R="$(fn account-delete '{"confirm":"EXCLUIR","password":"SenhaDeTeste12345"}' "$D2_TOKEN")"
echo "exclusao 2: $R"
check "conta com fotos: { ok: true }" has "$R" '{"ok":true}'
check "as fotos da conta (e da subpasta) foram removidas" bash -c '! printf "%s" "$1" | grep -q "foto-"' _ "$(storage_list "$D2_ID")"
check "a foto da subpasta tambem sumiu" bash -c '! printf "%s" "$1" | grep -q "foto-3"' _ "$(storage_list "$D2_ID/pasta")"
check "a foto de OUTRA conta nao foi tocada" has "$(storage_list "$OTHER_ID")" 'de-outro.png'
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
refresh() { curl -s -w '
%{http_code}' -X POST "$API_URL/auth/v1/token?grant_type=refresh_token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$1\"}"; }
RF1="$(refresh "$RT0")"
check "a primeira renovacao do refresh_token funciona (200)" test "$(http_code "$RF1")" = "200"
RT1="$(http_body "$RF1" | grep -oE '"refresh_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
RF2="$(refresh "$RT1")"
check "a segunda renovacao (com o token novo) funciona (200)" test "$(http_code "$RF2")" = "200"
# Com rotacao ligada, o token de duas geracoes atras nao e o pai do token ativo: reuso malicioso, recusado.
RF3="$(refresh "$RT0")"
echo "reuso do refresh_token de duas geracoes atras: HTTP $(http_code "$RF3"); $(http_body "$RF3" | grep -oE '"error_code":"[^"]*"' | head -1)"
# Informativo: o GoTrue desta versao respondeu 200 ao reuso em vez de revogar a sessao; a prova de que a rotacao esta
# ligada e a configuracao efetiva do container, conferida logo abaixo.
# Configuracao efetiva do container do Auth (so as chaves pedidas; nenhum segredo e impresso).
AUTH_C="$(docker ps --format '{{.Names}}' | grep -E '^supabase_auth_' | head -1)"
AUTH_ENV="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$AUTH_C" 2>/dev/null | grep -E '^GOTRUE_(SECURITY_REFRESH_TOKEN|EXTERNAL_ANONYMOUS|SECURITY_MANUAL|SECURITY_CAPTCHA_ENABLED|SECURITY_CAPTCHA_PROVIDER)' | sed -E 's/(SECRET=).*/<oculto>/')"
echo "configuracao efetiva do Auth ($AUTH_C):"; printf '%s\n' "$AUTH_ENV"
env_is() { printf '%s\n' "$AUTH_ENV" | grep -qx "$1"; }
check "Auth: rotacao de refresh token ligada" env_is "GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true"
check "Auth: intervalo de reuso do refresh token de 10 s" env_is "GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10"
check "Auth: entrada anonima desligada" env_is "GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false"
check "Auth: vinculo manual de identidades desligado" env_is "GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=false"
check "Auth: provedor do desafio e turnstile" env_is "GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile"
check "Auth: desafio ainda DESLIGADO (quem liga e a T104)" env_is "GOTRUE_SECURITY_CAPTCHA_ENABLED=false"

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

echo "== Spec 003 (T012 a T020): tabelas e funcoes de tag pela API, e o seed das tags =="
anon_code() { # anon_code <caminho REST>  -> codigo HTTP de um GET com a chave anonima
  curl -s -o /dev/null -w '%{http_code}' "$API_URL/rest/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
}
for T in pets rescue_profiles tag_batches tag_codes tag_assignments tag_pin_attempts pending_activations rate_limits scan_events tag_replacement_requests audit_log my_scans; do
  TC="$(anon_code "$T?select=*&limit=1")"
  check "anon lendo $T recebe 401 ou 403 (sem privilegio) [$TC]" bash -c '[ "$1" = "401" ] || [ "$1" = "403" ]' _ "$TC"
done
for F in end_assignments_for_account export_tutor_tag_data; do
  FC="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/rest/v1/rpc/$F" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"p_tutor":"00000000-0000-0000-0000-000000000001"}')"
  check "anon chamando $F recebe 401 ou 403 [$FC]" bash -c '[ "$1" = "401" ] || [ "$1" = "403" ]' _ "$FC"
done
SEED_JSON="e2e/fixtures/seed-codes.json"
seed_code() { sed -n "s/^  \"$1\": \"\([0-9A-Z]*\)\".*/\1/p" "$SEED_JSON" | head -1; }
seed_status_is() { # seed_status_is <chave do JSON> <status esperado>: o codigo do JSON esta no banco com esse status
  local code; code="$(seed_code "$1")"
  [ -n "$code" ] && curl -s "$API_URL/rest/v1/tag_codes?code=eq.$code&select=status" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" | grep -q "\"status\":\"$2\""
}
check "seed: $SEED_JSON existe e traz os codigos" test -s "$SEED_JSON"
check "seed: o codigo 'assigned' do JSON esta no banco como assigned" seed_status_is assigned assigned
check "seed: o codigo 'available' do JSON esta no banco como available" seed_status_is available available
check "seed: o codigo 'available2' do JSON esta no banco como available" seed_status_is available2 available
check "seed: o codigo 'available3' do JSON esta no banco como available" seed_status_is available3 available
check "seed: o codigo 'blocked' do JSON esta no banco como blocked" seed_status_is blocked blocked
check "seed: o codigo 'void' do JSON esta no banco como void" seed_status_is void void
SEED_COUNT="$(curl -s -o /dev/null -D - "$API_URL/rest/v1/tag_codes?select=code" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" | tr -d '\r' | sed -n 's/^[Cc]ontent-[Rr]ange: .*\///p')"
check "seed: select count(*) from tag_codes devolve 6 [$SEED_COUNT]" test "$SEED_COUNT" = "6"
# PINs DE DESENVOLVIMENTO (decisao de 2026-11-22): as tres tags available do seed (codigos sinteticos do lote-900, so em banco
# local ou de CI) tem PIN fixo em `devPins`. Nenhum PIN de tag real entra aqui, e nenhuma outra tag do seed tem PIN no JSON.
seed_pin() { sed -n "s/^    \"$1\": \"\([0-9A-Z]\{6\}\)\".*/\1/p" "$SEED_JSON" | head -1; }
seed_display() { sed -n "s/^    \"$1\": \"\([0-9A-Z]\{4\}-[0-9A-Z]\{4\}-[0-9A-Z]\)\".*/\1/p" "$SEED_JSON" | head -1; }
for K in available available2 available3; do
  check "seed: devPins.$K e um PIN de 6 caracteres do alfabeto Crockford" test -n "$(seed_pin "$K")"
done
check "seed: so as tres tags available tem PIN no JSON (nenhum para assigned, blocked ou void)" \
  bash -c '[ "$(grep -c "\"[0-9A-Z]\{6\}\"" "$1")" = "3" ]' _ "$SEED_JSON"
check "seed: o JSON nao tem campo activation_pin" bash -c '! grep -qi "activation_pin" "$1"' _ "$SEED_JSON"
# Os codigos do lote-900 e os PINs de desenvolvimento so podem aparecer em seed.sql, e2e/fixtures/ e nos testes. O codigo
# 7K3M-Q9XA-C (vetor sintetico do contrato) e documentado em todo lugar e fica de fora desta verificacao.
LEAK_PAT="$(mktemp)"
for K in available available2 available3 blocked void; do
  seed_code "$K"; seed_display "$K"
done | grep . > "$LEAK_PAT"
for K in available available2 available3; do seed_pin "$K"; done >> "$LEAK_PAT"
check "seed: a lista de padroes do lote-900 tem 13 entradas (5 codigos, 5 formas de exibicao e 3 PINs)" test "$(wc -l < "$LEAK_PAT")" = "13"
LEAK_HITS="$(git grep -n -i -F -f "$LEAK_PAT" -- . ':(exclude)supabase/seed.sql' ':(exclude)e2e' ':(exclude)supabase/tests' ':(exclude)*.test.ts' ':(exclude)*.spec.ts' | cut -d: -f1,2 || true)"
echo "arquivos com codigo do lote-900 ou PIN de desenvolvimento fora do permitido: ${LEAK_HITS:-nenhum}"
check "seed: nenhum codigo do lote-900 nem PIN de desenvolvimento fora de supabase/seed.sql, e2e/ e dos testes" test -z "$LEAK_HITS"
rm -f "$LEAK_PAT"

echo "== Spec 003 (T026, T027, T038, T050, T051): resolve-tag, register-scan e ativacao pela API =="
# O servidor SSR NAO tem chave do Supabase: so a chave `x-faro-ssr-key`. As chamadas abaixo mandam tambem apikey/Authorization
# (o gateway local aceita), mas a autorizacao de verdade e a chave do servidor.
check "config.toml declara verify_jwt = false para resolve-tag" bash -c 'grep -A1 "^\[functions.resolve-tag\]" supabase/config.toml | grep -q "verify_jwt = false"'
check "config.toml declara verify_jwt = false para register-scan" bash -c 'grep -A1 "^\[functions.register-scan\]" supabase/config.toml | grep -q "verify_jwt = false"'
ssr_call() { # ssr_call <funcao> <json>   (corpo da resposta, com a chave do servidor)
  curl -s -X POST "$API_URL/functions/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" -H "x-faro-ssr-key: $SSR_KEY" -d "$2"
}
ssr_head() { # ssr_head <funcao> <json>   (so os cabecalhos que precisam ser identicos)
  curl -s -D - -o /dev/null -X POST "$API_URL/functions/v1/$1" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" -H "x-faro-ssr-key: $SSR_KEY" -d "$2" | tr -d '\r' \
    | grep -iE '^(content-type|cache-control|content-length):' | tr 'A-Z' 'a-z' | sort
}
CODE_AS="$(seed_code assigned)"; CODE_AV="$(seed_code available)"; CODE_AV2="$(seed_code available2)"; CODE_AV3="$(seed_code available3)"
CODE_BL="$(seed_code blocked)"; CODE_VD="$(seed_code void)"
PIN_AV2="$(seed_pin available2)"; PIN_AV3="$(seed_pin available3)"
NONEXISTENT="H8ZWE5XGH" # vetor sintetico valido (digito correto) que nao esta no seed

RESOLVE_UP=0
for _ in $(seq 1 40); do
  R="$(ssr_call resolve-tag "{\"code\":\"$CODE_AV\",\"ip_hash\":\"ci-warm\"}" || true)"
  if has "$R" '"state"'; then RESOLVE_UP=1; break; fi
  sleep 2
done
check "resolve-tag responde com a chave do servidor" test "$RESOLVE_UP" = "1"
if [ "$RESOLVE_UP" != "1" ]; then echo "ultima resposta do resolve-tag: $(printf '%s' "$R" | cut -c1-200)"; fi

C="$(curl -s -o /tmp/resolve-nokey.out -w '%{http_code}' -X POST "$API_URL/functions/v1/resolve-tag" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"code\":\"$CODE_AS\",\"ip_hash\":\"x\"}")"
check "resolve-tag sem a chave do servidor: 401 com corpo vazio ($C)" bash -c '[ "$1" = "401" ] && [ ! -s /tmp/resolve-nokey.out ]' _ "$C"
C="$(curl -s -o /tmp/resolve-badkey.out -w '%{http_code}' -X POST "$API_URL/functions/v1/resolve-tag" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -H "x-faro-ssr-key: chave-errada-0123456789-0123456789-abcdef" -d "{\"code\":\"$CODE_AS\",\"ip_hash\":\"x\"}")"
check "resolve-tag com chave errada: 401 com corpo vazio ($C)" bash -c '[ "$1" = "401" ] && [ ! -s /tmp/resolve-badkey.out ]' _ "$C"
# Diagnostico (nao reprova): o servidor SSR real chama SEM apikey/Authorization; confere se o gateway local deixa passar.
C="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/functions/v1/resolve-tag" -H "Content-Type: application/json" -H "x-faro-ssr-key: $SSR_KEY" -d "{\"code\":\"$CODE_AV\",\"ip_hash\":\"ci-sem-apikey\"}")"
echo "diagnostico: resolve-tag so com x-faro-ssr-key (sem apikey nem Authorization): HTTP $C"

RA="$(ssr_call resolve-tag "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-resolve-1\"}")"
check "resolve-tag (tag vinculada do seed): state assigned com o nome do pet" bash -c 'printf "%s" "$1" | grep -q "\"state\":\"assigned\"" && printf "%s" "$1" | grep -qF "Paçoca"' _ "$RA"
check "resolve-tag: devolve o primeiro nome (\"Tutor\", de \"Tutor A Teste\") e o link do WhatsApp liberados pela tutora do seed" bash -c 'printf "%s" "$1" | grep -qF "\"tutor_first_name\":\"Tutor\"" && printf "%s" "$1" | grep -qF "\"whatsapp_url\":\"https://wa.me/5511900000001?text="' _ "$RA"
check "resolve-tag: o codigo sai no formato XXXX-XXXX-X" has "$RA" "\"code\":\"$(seed_display assigned)\""
check "resolve-tag: nenhum identificador interno, ip_hash, hash de PIN nem photo_path" \
  bash -c '! printf "%s" "$1" | grep -qiE "tutor_id|pet_id|assignment|ip_hash|activation_pin|photo_path|00000000-0000"' _ "$RA"
check "resolve-tag: o telefone nao liberado (show_phone desligado) nao aparece" bash -c '! printf "%s" "$1" | grep -q "phone_display"' _ "$RA"
RV="$(ssr_call resolve-tag "{\"code\":\"$CODE_AV\",\"ip_hash\":\"ci-resolve-2\"}")"
check "resolve-tag (tag disponivel do seed): state available com o codigo formatado" test "$RV" = "{\"state\":\"available\",\"code\":\"$(seed_display available)\"}"
B_BL="$(ssr_call resolve-tag "{\"code\":\"$CODE_BL\",\"ip_hash\":\"ci-resolve-3\"}")"
B_VD="$(ssr_call resolve-tag "{\"code\":\"$CODE_VD\",\"ip_hash\":\"ci-resolve-4\"}")"
B_NX="$(ssr_call resolve-tag "{\"code\":\"$NONEXISTENT\",\"ip_hash\":\"ci-resolve-5\"}")"
B_BAD="$(ssr_call resolve-tag "{\"code\":\"7K3MQ9XAD\",\"ip_hash\":\"ci-inv-ip\"}")"
check "anti-enumeracao: bloqueado, anulado, inexistente e digito invalido dao o mesmo corpo (not_found)" \
  test "$B_BL" = '{"state":"not_found"}' -a "$B_VD" = '{"state":"not_found"}' -a "$B_NX" = '{"state":"not_found"}' -a "$B_BAD" = '{"state":"not_found"}'
H_BL="$(ssr_head resolve-tag "{\"code\":\"$CODE_BL\",\"ip_hash\":\"ci-resolve-6\"}")"
H_VD="$(ssr_head resolve-tag "{\"code\":\"$CODE_VD\",\"ip_hash\":\"ci-resolve-7\"}")"
H_NX="$(ssr_head resolve-tag "{\"code\":\"$NONEXISTENT\",\"ip_hash\":\"ci-resolve-8\"}")"
echo "cabecalhos do not_found: $(printf '%s' "$H_NX" | tr '\n' ' ')"
check "anti-enumeracao: bloqueado, anulado e inexistente dao os mesmos cabecalhos" test -n "$H_BL" -a "$H_BL" = "$H_VD" -a "$H_VD" = "$H_NX"
check "resolve-tag responde sem cache (Cache-Control: no-store)" has "$H_NX" 'cache-control: no-store'
T_NX="$(curl -s -o /dev/null -w '%{time_total}' -X POST "$API_URL/functions/v1/resolve-tag" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -H "x-faro-ssr-key: $SSR_KEY" -d "{\"code\":\"$NONEXISTENT\",\"ip_hash\":\"ci-resolve-9\"}")"
check "resolve-tag: not_found respeita o piso de 150 ms ($T_NX s)" awk -v t="$T_NX" 'BEGIN { exit !(t >= 0.15) }'
check "digito invalido nao toca o banco: nenhuma linha de limite para o ip_hash dele" test "$(rest GET 'rate_limits?key=eq.ci-inv-ip&select=key')" = "[]"
RL_AT=0
for i in $(seq 1 70); do
  R="$(ssr_call resolve-tag "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-flood-resolve\"}")"
  if has "$R" '"state":"rate_limited"'; then RL_AT="$i"; break; fi
done
echo "resolve-tag: rate_limited apareceu na chamada $RL_AT do mesmo ip_hash (esperado 31, ou ate 61 se a janela de 1 minuto virou no meio)"
check "resolve-tag: o limite por ip_hash (30 por minuto) e aplicado" bash -c '[ "$1" -ge 2 ] && [ "$1" -le 61 ]' _ "$RL_AT"

# --- register-scan ---
C="$(curl -s -o /tmp/scan-nokey.out -w '%{http_code}' -X POST "$API_URL/functions/v1/register-scan" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-nokey\"}")"
check "register-scan sem a chave do servidor: 401 com corpo vazio ($C)" bash -c '[ "$1" = "401" ] && [ ! -s /tmp/scan-nokey.out ]' _ "$C"
check "register-scan sem a chave nao gravou scan" test "$(rest GET 'scan_events?ip_hash=eq.ci-scan-nokey&select=id')" = "[]"

RS1="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-1\"}")"
check "register-scan: scan novo responde owner false com scan_token" bash -c 'printf "%s" "$1" | grep -q "\"owner\":false" && printf "%s" "$1" | grep -qE "\"scan_token\":\"[0-9a-f]{64}\""' _ "$RS1"
check "register-scan: a resposta nao traz scan_id, e-mail nem notify" bash -c '! printf "%s" "$1" | grep -qE "scan_id|notify|@faro.test"' _ "$RS1"
SCAN_ROW="$(rest GET 'scan_events?ip_hash=eq.ci-scan-1&select=status_at_scan,geo_method,notify_attempts,assignment_id')"
check "register-scan: o scan foi gravado (assigned, sem geo, com vinculo)" bash -c 'printf "%s" "$1" | grep -q "\"status_at_scan\":\"assigned\"" && printf "%s" "$1" | grep -q "\"geo_method\":\"none\"" && printf "%s" "$1" | grep -q "00000000-0000-0000-0000-0000000b0001"' _ "$SCAN_ROW"
NOTIFIED=0
for _ in $(seq 1 15); do
  if has "$(rest GET 'scan_events?ip_hash=eq.ci-scan-1&select=notified_at')" '"notified_at":"20'; then NOTIFIED=1; break; fi
  sleep 1
done
check "register-scan: o aviso saiu fora do caminho da resposta (driver de teste) e notified_at foi gravado" test "$NOTIFIED" = "1"
check "register-scan: o aviso saiu no driver log (so o assunto)" bash -c 'grep -qF "[email:log] assunto=A tag do Paçoca foi escaneada" "$1"' _ "$LOG_FILE"
RS2="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-1\"}")"
check "register-scan: o mesmo codigo e origem em seguida e duplicado (devolve token novo)" has "$RS2" '"scan_token"'
check "register-scan: duplicado nao cria outra linha" test "$(rest GET 'scan_events?ip_hash=eq.ci-scan-1&select=id' | grep -o '"id"' | wc -l)" = "1"
TOKEN_SCAN="$(printf '%s' "$RS2" | grep -oE '"scan_token":"[0-9a-f]{64}"' | cut -d'"' -f4)"
# Endurecimento (T103, contrato secao 3): scan_ip_min = 20 por minuto por ip_hash. Do 21o em diante: 200 sem efeito (o duplicado
# normal devolve um scan_token novo; o limitado devolve so {"owner":false}, e nenhum aviso sai).
# A janela e fixa (minuto cheio): comeca nos 30 primeiros segundos do minuto para as 21 chamadas cairem na mesma janela.
while [ "$(date +%S)" -ge 30 ]; do sleep 1; done
RS_LAST=""
for i in $(seq 1 20); do RS_LAST="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-flood\"}")"; done
check "scan_ip_min: a 20a chamada do mesmo ip_hash ainda e atendida (traz scan_token)" has "$RS_LAST" '"scan_token"'
RS_21="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-flood\"}")"
check "scan_ip_min: a 21a chamada em um minuto devolve 200 sem efeito ({\"owner\":false}, sem scan_token)" test "$RS_21" = '{"owner":false}'
check "scan_ip_min: o limite nao criou linha de scan a mais (1 scan para o ip_hash)" test "$(rest GET 'scan_events?ip_hash=eq.ci-scan-flood&select=id' | grep -o '"id"' | wc -l)" = "1"
check "scan_ip_min: o contador do banco chegou a 21" has "$(rest GET 'rate_limits?scope=eq.scan_ip_min&key=eq.ci-scan-flood&select=count')" '"count":21'
RS3="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-geo\",\"geo\":{\"lat\":-23.5505,\"lng\":-46.6333,\"city\":\"São Paulo\",\"region\":\"SP\"}}")"
check "register-scan: com coordenadas do cabecalho grava metodo ip com margem de 3000 m" \
  bash -c 'printf "%s" "$1" | grep -q "\"geo_method\":\"ip\"" && printf "%s" "$1" | grep -q "\"accuracy_m\":3000"' _ "$(rest GET 'scan_events?ip_hash=eq.ci-scan-geo&select=geo_method,accuracy_m,city')"
RS4="$(ssr_call register-scan "{\"code\":\"$CODE_AV\",\"ip_hash\":\"ci-scan-av\"}")"
RS5="$(ssr_call register-scan "{\"code\":\"$CODE_BL\",\"ip_hash\":\"ci-scan-bl\"}")"
RS6="$(ssr_call register-scan "{\"code\":\"$CODE_VD\",\"ip_hash\":\"ci-scan-vd\"}")"
SCAN_Q="$(rest GET 'scan_events?ip_hash=in.(ci-scan-av,ci-scan-bl,ci-scan-vd)&select=status_at_scan,assignment_id,notified_at,notify_attempts')"
check "register-scan: tag disponivel, bloqueada e anulada gravam para a fila do admin (sem vinculo, sem aviso)" \
  bash -c 'for s in available blocked void; do printf "%s" "$1" | grep -q "\"status_at_scan\":\"$s\"" || exit 1; done; ! printf "%s" "$1" | grep -q "\"notified_at\":\"" && ! printf "%s" "$1" | grep -q "\"notify_attempts\":[1-9]"' _ "$SCAN_Q"
RS7="$(ssr_call register-scan "{\"code\":\"7K3MQ9XAD\",\"ip_hash\":\"ci-scan-inv\"}")"
check "register-scan: codigo com digito invalido responde owner false e nao grava" bash -c '[ "$1" = "{\"owner\":false}" ]' _ "$RS7"
check "register-scan: o codigo invalido nao gravou scan" test "$(rest GET 'scan_events?ip_hash=eq.ci-scan-inv&select=id')" = "[]"
# Localizacao precisa pelo token (uso unico) e aviso de localizacao.
LOC_BODY="{\"action\":\"location\",\"scan_token\":\"$TOKEN_SCAN\",\"lat\":-23.5614,\"lng\":-46.6559,\"accuracy_m\":12}"
RL1="$(ssr_call register-scan "$LOC_BODY")"
check "register-scan (location): token valido atualiza o scan" test "$RL1" = '{"updated":true}'
check "register-scan (location): o scan passou a gps com as coordenadas e a margem" \
  bash -c 'printf "%s" "$1" | grep -q "\"geo_method\":\"gps\"" && printf "%s" "$1" | grep -q "\"accuracy_m\":12"' _ "$(rest GET 'scan_events?ip_hash=eq.ci-scan-1&select=geo_method,accuracy_m,lat,lng')"
RL2="$(ssr_call register-scan "$LOC_BODY")"
check "register-scan (location): o token e de uso unico (a segunda vez nao tem efeito)" test "$RL2" = '{"updated":false}'
LOC_MAIL=0
for _ in $(seq 1 15); do
  if grep -qF "[email:log] assunto=Quem achou o Paçoca enviou a localização" "$LOG_FILE"; then LOC_MAIL=1; break; fi
  sleep 1
done
check "register-scan (location): o aviso de localizacao saiu (driver log)" test "$LOC_MAIL" = "1"
RL3="$(ssr_call register-scan '{"action":"location","scan_token":"0000000000000000000000000000000000000000000000000000000000000000","lat":-23.5,"lng":-46.6,"accuracy_m":10}')"
check "register-scan (location): token inventado: 200 sem efeito" test "$RL3" = '{"updated":false}'
# Dono logado: nada gravado, nenhum aviso.
OWNER_LOGIN="$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"tutor.a@faro.test","password":"TesteSenha123!"}')"
OWNER_TOKEN="$(printf '%s' "$OWNER_LOGIN" | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
check "login da Ana (dona do Paçoca no seed)" test -n "$OWNER_TOKEN"
RS8="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-owner\",\"user_jwt\":\"$OWNER_TOKEN\"}")"
check "register-scan: o dono logado recebe owner true" test "$RS8" = '{"owner":true}'
check "register-scan: o dono logado nao gera scan" test "$(rest GET 'scan_events?ip_hash=eq.ci-scan-owner&select=id')" = "[]"
RS9="$(ssr_call register-scan "{\"code\":\"$CODE_AS\",\"ip_hash\":\"ci-scan-badjwt\",\"user_jwt\":\"token-invalido\"}")"
check "register-scan: JWT invalido nao e dono (o scan e gravado)" has "$RS9" '"owner":false'
RR="$(ssr_call register-scan '{"action":"resend"}')"
check "register-scan (resend): responde {sent, failed} sem erro" bash -c 'printf "%s" "$1" | grep -qE "^\{\"sent\":[0-9]+,\"failed\":[0-9]+\}$"' _ "$RR"
rest DELETE 'scan_events?ip_hash=like.ci-scan-*' > /dev/null
rest DELETE 'scan_events?ip_hash=like.ci-resolve-*' > /dev/null
check "limpeza: os scans de teste do CI foram removidos (o seed volta a ter so os 3 do Paçoca)" \
  test "$(rest GET 'scan_events?select=id' | grep -o '"id"' | wc -l)" = "3"

# --- activate_tag pela API: o PIN de desenvolvimento do seed, o contador que sobrevive ao erro e a corrida ---
act_a() { # act_a <json do corpo>  (RPC activate_tag como a Ana)
  curl -s -X POST "$API_URL/rest/v1/rpc/activate_tag" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $OWNER_TOKEN" \
    -H "Content-Type: application/json" -d "$1"
}
MEL_ID="00000000-0000-0000-0000-0000000a0002"
AC="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/rest/v1/rpc/activate_tag" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"p_code\":\"$CODE_AV3\",\"p_pin\":\"$PIN_AV3\",\"p_pet_id\":\"$MEL_ID\"}")"
check "anon chamando activate_tag recebe 401 ou 403 [$AC]" bash -c '[ "$1" = "401" ] || [ "$1" = "403" ]' _ "$AC"
R="$(act_a "{\"p_code\":\"$CODE_AV2\",\"p_pin\":\"000000\",\"p_pet_id\":\"$MEL_ID\"}")"
check "activate_tag: PIN errado devolve {ok:false, error:wrong_pin} (sem excecao)" has "$R" '"error": "wrong_pin"'
check "activate_tag: depois do wrong_pin a tentativa FICOU gravada (a contagem sobrevive ao retorno)" \
  has "$(rest GET "tag_pin_attempts?tag_code=eq.$CODE_AV2&select=fail_count")" '"fail_count":1'
R="$(act_a "{\"p_code\":\"$CODE_AV2\",\"p_pin\":\"$PIN_AV2\",\"p_pet_id\":\"00000000-0000-0000-0000-0000000a0099\"}")"
check "activate_tag: pet que nao e da conta: pet_not_found (antes do PIN)" has "$R" '"error": "pet_not_found"'
R="$(act_a "{\"p_code\":\"$NONEXISTENT\",\"p_pin\":\"$PIN_AV2\",\"p_pet_id\":\"$MEL_ID\"}")"
check "activate_tag: codigo inexistente: tag_unavailable" has "$R" '"error": "tag_unavailable"'
R="$(act_a "{\"p_code\":\"$CODE_BL\",\"p_pin\":\"$PIN_AV2\",\"p_pet_id\":\"$MEL_ID\"}")"
check "activate_tag: tag bloqueada: a mesma resposta (tag_unavailable)" has "$R" '"error": "tag_unavailable"'

# Corrida: quatro ativacoes simultaneas da MESMA tag com o PIN certo: exatamente uma vence.
RACE_BODY="{\"p_code\":\"$CODE_AV3\",\"p_pin\":\"$PIN_AV3\",\"p_pet_id\":\"$MEL_ID\"}"
rm -f /tmp/race-*.out
RACE_PIDS=()
for i in 1 2 3 4; do
  act_a "$RACE_BODY" > "/tmp/race-$i.out" &
  RACE_PIDS+=("$!")
done
wait "${RACE_PIDS[@]}"
RACE_ALL="$(for i in 1 2 3 4; do cat "/tmp/race-$i.out"; echo; done)"
RACE_OK="$(printf '%s\n' "$RACE_ALL" | grep -cE '"ok": ?true' || true)"
RACE_UNAV="$(printf '%s\n' "$RACE_ALL" | grep -c '"error": "tag_unavailable"' || true)"
echo "corrida de 4 ativacoes: $RACE_OK com sucesso, $RACE_UNAV tag_unavailable"
check "corrida: exatamente UMA das 4 ativacoes simultaneas vence" test "$RACE_OK" = "1"
check "corrida: as outras 3 recebem tag_unavailable" test "$RACE_UNAV" = "3"
check "corrida: a tag tem um unico vinculo ativo" test "$(rest GET "tag_assignments?tag_code=eq.$CODE_AV3&ended_at=is.null&select=id" | grep -o '"id"' | wc -l)" = "1"
check "corrida: a tag ficou assigned" seed_status_is available3 assigned
R="$(act_a "{\"p_code\":\"$CODE_AV2\",\"p_pin\":\"$PIN_AV2\",\"p_pet_id\":\"$MEL_ID\"}")"
check "activate_tag: o PIN de desenvolvimento do segundo codigo confere (a Mel ja tem tag: pet_has_tag, depois do PIN)" has "$R" '"error": "pet_has_tag"'
# Limpeza: devolve o seed ao estado de antes (vinculo da Mel encerrado, tag available, tentativas zeradas).
# +1 minuto: ended_at tem de ser >= started_at, que tem fracao de segundo (a data com segundos inteiros podia ficar antes dele).
NOW_ISO="$(date -u -d "+1 minute" +%Y-%m-%dT%H:%M:%SZ)"
rest PATCH "tag_assignments?tag_code=eq.$CODE_AV3&ended_at=is.null" "{\"ended_at\":\"$NOW_ISO\",\"end_reason\":\"admin\"}" > /dev/null
rest PATCH "tag_codes?code=eq.$CODE_AV3" '{"status":"available","pin_fail_count_24h":0,"pin_fail_window_start":null,"pin_locked_until":null}' > /dev/null
rest PATCH "tag_codes?code=eq.$CODE_AV2" '{"pin_fail_count_24h":0,"pin_fail_window_start":null,"pin_locked_until":null}' > /dev/null
rest DELETE "tag_pin_attempts?tag_code=in.($CODE_AV2,$CODE_AV3)" > /dev/null
check "limpeza: available3 voltou a available" seed_status_is available3 available
check "limpeza: nenhum vinculo ativo restou para a Mel" test "$(rest GET "tag_assignments?pet_id=eq.$MEL_ID&ended_at=is.null&select=id")" = "[]"

echo "== T076: admin-create-batch pelo gateway (JWT de admin, pacote com pins.csv, PIN do CSV ativa o codigo) =="
ADMIN_TOKEN="$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@faro.test","password":"TesteSenha123!"}' | grep -oE '"access_token":"[^"]+"' | head -1 | cut -d'"' -f4)"
check "login do admin do seed (token lido)" test -n "$ADMIN_TOKEN"
batch_call() { # batch_call <token> <json> <arquivo de saida>  (imprime so o codigo HTTP; cabecalhos em /tmp/batch.headers)
  curl -s -o "$3" -D /tmp/batch.headers -w '%{http_code}' -X POST "$API_URL/functions/v1/admin-create-batch" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$2"
}
check "admin-create-batch: chave anonima (sem admin) responde 401" test "$(batch_call "$ANON_KEY" '{"quantity":2}' /tmp/batch.none)" = "401"
check "admin-create-batch: tutor comum responde 403" test "$(batch_call "$TOKEN_B" '{"quantity":2}' /tmp/batch.none)" = "403"
check "admin-create-batch: quantidade invalida responde 400" test "$(batch_call "$ADMIN_TOKEN" '{"quantity":0}' /tmp/batch.none)" = "400"
check "admin-create-batch: nenhum lote foi criado pelas chamadas recusadas" test "$(rest GET 'tag_batches?id=not.eq.lote-900&select=id')" = "[]"
rm -f /tmp/batch.zip /tmp/batch-out
BATCH_CODE="$(batch_call "$ADMIN_TOKEN" '{"quantity":3,"notes":"lote de teste do CI"}' /tmp/batch.zip)"
check "admin-create-batch: admin cria um lote de 3 (200)" test "$BATCH_CODE" = "200"
check "admin-create-batch: a resposta e application/zip" bash -c 'grep -iq "^content-type: application/zip" /tmp/batch.headers'
check "admin-create-batch: Cache-Control: no-store" bash -c 'grep -iq "^cache-control: no-store" /tmp/batch.headers'
check "admin-create-batch: o primeiro lote criado e lote-002 (o seed usa lote-900 e nao conta)" bash -c 'grep -iq "^x-batch-id: lote-002" /tmp/batch.headers'
mkdir -p /tmp/batch-out && (cd /tmp/batch-out && unzip -o -q /tmp/batch.zip)
check "admin-create-batch: o pacote tem so pins.csv" test "$(ls /tmp/batch-out)" = "pins.csv"
check "admin-create-batch: pins.csv tem cabecalho e 3 linhas no formato XXXX-XXXX-X,PIN" \
  bash -c 'head -1 /tmp/batch-out/pins.csv | grep -qx "code,pin" && [ "$(tail -n +2 /tmp/batch-out/pins.csv | grep -cE "^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z],[0-9A-HJKMNP-TV-Z]{6}$")" = "3" ]'
check "admin-create-batch: 3 codigos available no lote-002, todos com hash bcrypt de custo 12 (nenhum PIN em tabela)" \
  bash -c 'r="$1"; [ "$(printf "%s" "$r" | grep -o "\"status\":\"available\"" | wc -l)" = "3" ] && [ "$(printf "%s" "$r" | grep -oE "\"activation_pin_hash\":\"\\\$2[abxy]\\\$12\\\$" | wc -l)" = "3" ]' _ \
  "$(rest GET 'tag_codes?batch_id=eq.lote-002&select=status,activation_pin_hash')"
BATCH_ROW="$(sed -n 2p /tmp/batch-out/pins.csv)"
BATCH_CODE_1="$(printf '%s' "${BATCH_ROW%%,*}" | tr -d '-')"
BATCH_PIN_1="${BATCH_ROW##*,}"
R="$(act_a "{\"p_code\":\"$BATCH_CODE_1\",\"p_pin\":\"$BATCH_PIN_1\",\"p_pet_id\":\"$MEL_ID\"}")"
check "admin-create-batch: o PIN do pins.csv ativa o codigo correspondente" has "$R" '"ok": true'
check "admin-create-batch: nenhum PIN do pacote aparece no log da funcao" bash -c '! grep -qF "$1" "$2"' _ "$BATCH_PIN_1" "$LOG_FILE"
SECOND="$(batch_call "$ADMIN_TOKEN" '{"quantity":1}' /tmp/batch.second)"
check "admin-create-batch: o segundo lote recebe outro id (lote-003)" bash -c 'test "$1" = "200" && grep -iq "^x-batch-id: lote-003" /tmp/batch.headers' _ "$SECOND"
check "admin-create-batch: auditoria batch_created e batch_package_downloaded sem PIN" \
  bash -c 'a="$(printf "%s" "$1")"; printf "%s" "$a" | grep -q "batch_created" && printf "%s" "$a" | grep -q "batch_package_downloaded" && ! printf "%s" "$a" | grep -qF "$2"' _ \
  "$(rest GET 'audit_log?entity_id=in.(lote-002,lote-003)&select=event,detail')" "$BATCH_PIN_1"
# Limpeza: encerra o vinculo da Mel com o codigo do lote (o resto fica: codigo nunca e apagado).
rest PATCH "tag_assignments?tag_code=eq.$BATCH_CODE_1&ended_at=is.null" "{\"ended_at\":\"$(date -u -d '+1 minute' +%Y-%m-%dT%H:%M:%SZ)\",\"end_reason\":\"admin\"}" > /dev/null
rm -rf /tmp/batch-out /tmp/batch.zip /tmp/batch.second /tmp/batch.none /tmp/batch.headers

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
