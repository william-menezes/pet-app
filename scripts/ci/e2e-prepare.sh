#!/usr/bin/env bash
# Prepara o job `e2e` do CI (spec 004): le as chaves do stack local, gera o ambiente do app DENTRO DO RUNNER,
# sobe o `functions serve` com o ambiente de teste e espera tudo ficar pronto.
#
# Pre-requisito: `supabase start` ja executado. Valores de teste descartaveis, so do stack local do runner.
# Nada aqui e versionado com valores: `src/environments/environment.e2e.ts` esta no .gitignore.
set -euo pipefail

STATUS_ENV="$(supabase status -o env 2>/dev/null || true)"
env_value() { printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p" | head -1; }
API_URL="$(env_value API_URL)"
ANON_KEY="$(env_value ANON_KEY)"
SERVICE_KEY="$(env_value SERVICE_ROLE_KEY)"
if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "nao foi possivel ler API_URL, ANON_KEY e SERVICE_ROLE_KEY de 'supabase status -o env'"
  exit 1
fi
echo "::add-mask::$ANON_KEY"
echo "::add-mask::$SERVICE_KEY"

# Variaveis para os passos seguintes (o E2E real le daqui). Nada e impresso.
{
  echo "E2E_SUPABASE_URL=$API_URL"
  echo "E2E_ANON_KEY=$ANON_KEY"
  echo "E2E_SERVICE_KEY=$SERVICE_KEY"
  echo "E2E_MAIL_URL=http://127.0.0.1:54324"
} >> "$GITHUB_ENV"

# Ambiente do app so no runner (o modelo versionado e src/environments/environment.e2e.example.ts).
cat > src/environments/environment.e2e.ts <<EOF
export const environment = {
  production: false,
  supabaseUrl: '$API_URL',
  supabaseAnonKey: '$ANON_KEY',
  turnstileSiteKey: '',
};
EOF

# Edge Functions: ambiente de teste (SMS simulado, FARO_ENV=test).
cat > supabase/.env.local <<'EOF'
HASH_SALT=ci-test-salt-0123456789
ALLOWED_ORIGINS=http://localhost:4200
SITE_URL=http://localhost:4200
PHONE_OTP_PEPPER=ci-test-pepper-0123456789-0123456789-abcdef
FARO_ENV=test
SMS_DRIVER=stub
SMS_STUB_CODE=424242
EOF
setsid nohup supabase functions serve --env-file supabase/.env.local > /tmp/functions-serve.log 2>&1 &
disown || true

ready=0
for _ in $(seq 1 60); do
  r="$(curl -s -X POST "$API_URL/functions/v1/phone-verify-confirm" -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{}' || true)"
  if printf '%s' "$r" | grep -q '"ok":false'; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != "1" ]; then
  echo "functions serve nao subiu"; tail -40 /tmp/functions-serve.log || true; exit 1
fi
echo "functions serve pronto"

# Aquecimento: o primeiro e-mail do stack recem-subido pode sair com o modelo padrao (ver supabase-checks.sh).
for attempt in 1 2 3 4 5 6; do
  W="ci-warm-$RANDOM$RANDOM@faro.test"
  curl -s -o /dev/null -X POST "$API_URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$W\",\"password\":\"SenhaDeTeste12345\",\"data\":{\"name\":\"CI Aquecimento\",\"terms_version\":\"2026-11\"}}"
  html=""
  for _ in $(seq 1 10); do
    id="$(curl -s "http://127.0.0.1:54324/api/v1/search?query=to:$W" | grep -oE '"ID":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
    if [ -n "$id" ]; then html="$(curl -s "http://127.0.0.1:54324/api/v1/message/$id")"; break; fi
    sleep 1
  done
  if printf '%s' "$html" | grep -q "/auth/confirmar-email?token_hash="; then echo "aquecimento ok na tentativa $attempt"; break; fi
  echo "aquecimento: tentativa $attempt sem o modelo do repositorio"; sleep 10
done
