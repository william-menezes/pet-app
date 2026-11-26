#!/usr/bin/env bash
# Spec 003, correcao C1 (gate humano): o bloqueio por tentativas de PIN nao pode ser furado por chamadas paralelas.
# Prova com sessoes SIMULTANEAS de verdade no Postgres do stack local (pgTAP roda numa sessao so e nao alcanca isto).
#
# Como: um coordenador segura um advisory lock; N sessoes (cada uma um `psql` em `docker exec`) entram numa transacao,
# esperam esse lock e, quando ele cai, chamam `activate_tag` todas ao mesmo tempo, como a role `authenticated` com o
# JWT (claims) de um tutor. Sem a releitura do bloqueio depois do FOR UPDATE, todas passariam pela checagem inicial e
# cada uma testaria um PIN.
#
# Cenarios:
#   A  uma conta, 20 PINs errados ao mesmo tempo: contador da conta = 5; o PIN certo durante o bloqueio devolve locked.
#      (Chamadas da MESMA conta ja se enfileiram pela linha do contador do rpc_guard: vale como regressao.)
#   B  8 contas DIFERENTES na mesma tag com 19 erros no contador: so o FOR UPDATE da tag as serializa. O contador tem de
#      parar em exatamente 20 (antes da correcao ia a 27) e o PIN certo de outra conta devolve locked.
#   C  4 rodadas, 8 contas por tag (19 erros), PINs certos e errados misturados: se o bloqueio da tag foi gravado, a tag NAO
#      pode ter sido ativada depois dele.
#
# Pre-requisito: `supabase start`. Docker acessivel. Roda tudo e so no fim sai com erro. Nunca imprime PIN nem hash: o PIN
# vive so em variavel de shell (gerado na hora, descartavel) e o stack e local. Os dados criados ficam no banco local
# (codigo de tag nunca e apagado); `supabase db reset` limpa.
set -uo pipefail

DB="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -1)"
if [ -z "$DB" ]; then echo "FAIL  container do banco do Supabase local nao encontrado"; exit 1; fi

FAILED=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILED=1; }
expect() { # expect "descricao" esperado obtido
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (esperado=$2 obtido=$3)"; fi
}
psql_db() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

RUN="$(date +%s)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PIN="$(psql_db -c "select public.new_activation_pin()")"
WRONG="$([ "${PIN:0:1}" = "0" ] && echo 1 || echo 0)${PIN:1}"

uuid_for() { printf '5c1c%04x-0000-4000-8000-%012x' "$1" "$RUN"; }

# ── Dados ───────────────────────────────────────────────────────────────
psql_db >/dev/null <<SQL
INSERT INTO public.tag_batches (id, quantity) VALUES ('lote-911', 90) ON CONFLICT (id) DO NOTHING;
SQL

new_tag() { # new_tag  -> imprime um codigo novo e valido (available, com o PIN do script)
  psql_db -v pin="$PIN" <<'SQL'
WITH body AS (
  SELECT string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::integer, 1), '') AS b
    FROM generate_series(1, 8)
), ins AS (
  INSERT INTO public.tag_codes (code, batch_id, status, activation_pin_hash, qr_mask)
  SELECT b || public.tag_check_digit(b), 'lote-911', 'available', extensions.crypt(:'pin', extensions.gen_salt('bf', 12)), 0
    FROM body
  RETURNING code
)
SELECT code FROM ins;
SQL
}

new_user() { # new_user <n>  -> cria o tutor n (celular confirmado) e um pet; imprime o id do usuario
  local uid pid
  uid="$(uuid_for "$1")"
  pid="$(printf '5c1d%04x-0000-4000-8000-%012x' "$1" "$RUN")"
  psql_db >/dev/null <<SQL
INSERT INTO auth.users (id, email, role, aud, raw_user_meta_data, raw_app_meta_data, encrypted_password, created_at, updated_at, confirmation_token)
VALUES ('$uid', 'pin-conc-$RUN-$1@faro.test', 'authenticated', 'authenticated',
        '{"name":"Conc $1","terms_version":"2026-11"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
        extensions.crypt('SenhaDeTeste123', extensions.gen_salt('bf')), now(), now(), '');
UPDATE public.perfis SET celular = '+55119' || lpad((($RUN % 1000000) * 100 + $1)::text, 8, '0'), celular_confirmado_em = now() WHERE id = '$uid';
INSERT INTO public.pets (id, tutor_id, name, species) VALUES ('$pid', '$uid', 'Pet $1', 'dog');
SQL
  echo "$uid"
}
pet_of() { printf '5c1d%04x-0000-4000-8000-%012x' "$1" "$RUN"; }

# ── Disparo simultaneo ──────────────────────────────────────────────────
# fire_batch <dir> <chamada>...   chamada = "<n do usuario>:<w|r>:<codigo>"   (w = PIN errado, r = PIN certo)
# Escreve o erro (ou "ok") de cada chamada em <dir>/<indice>.
fire_batch() {
  local dir="$1"; shift
  mkdir -p "$dir"
  local key=$((RANDOM + 1000))
  # Coordenador: segura o lock ate ser encerrado.
  docker exec -i "$DB" psql -U postgres -d postgres -qtA -c "select pg_advisory_lock($key); select pg_sleep(120);" >/dev/null 2>&1 &
  local coord=$!
  for _ in $(seq 1 50); do
    [ "$(psql_db -c "select count(*) from pg_locks where locktype='advisory' and granted and ((classid::bigint<<32)|objid::bigint)=$key")" = "1" ] && break
    sleep 0.2
  done
  local i=0 spec n kind code uid pin
  local pids=()
  for spec in "$@"; do
    n="${spec%%:*}"; kind="${spec#*:}"; kind="${kind%%:*}"; code="${spec##*:}"
    uid="$(uuid_for "$n")"
    if [ "$kind" = "r" ]; then pin="$PIN"; else pin="$WRONG"; fi
    (
      docker exec -i "$DB" psql -U postgres -d postgres -qtA -v ON_ERROR_STOP=1 <<SQL > "$dir/$i" 2>"$dir/$i.err"
BEGIN;
\o /dev/null
SELECT pg_advisory_xact_lock_shared($key);
SELECT set_config('request.jwt.claims', json_build_object('sub', '$uid', 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', '$uid', true),
       set_config('role', 'authenticated', true);
\o
SELECT coalesce(public.activate_tag('$code', '$pin', '$(pet_of "$n")') ->> 'error', 'ok');
COMMIT;
SQL
    ) &
    pids+=($!)
    i=$((i + 1))
  done
  # Espera todos estarem parados no lock (ou desistir), solta o coordenador e junta as sessoes.
  for _ in $(seq 1 100); do
    waiting="$(psql_db -c "select count(*) from pg_locks where locktype='advisory' and not granted and ((classid::bigint<<32)|objid::bigint)=$key")"
    [ "$waiting" -ge "$#" ] && break
    sleep 0.2
  done
  kill "$coord" 2>/dev/null
  psql_db -c "select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and granted and ((classid::bigint<<32)|objid::bigint)=$key" >/dev/null
  wait "${pids[@]}" 2>/dev/null
}
tally() { # tally <dir> <resultado>  -> quantas chamadas devolveram esse resultado
  local c=0 f
  for f in "$1"/[0-9]*; do
    case "$f" in *.err) continue;; esac
    [ "$(tr -d '[:space:]' < "$f")" = "$2" ] && c=$((c + 1))
  done
  echo "$c"
}
tag_row() { psql_db -c "select status || '|' || pin_fail_count_24h || '|' || (pin_locked_until is not null)::text from public.tag_codes where code = '$1'"; }

ONLY="${PIN_CONC_ONLY:-ABC}" # so para depurar: PIN_CONC_ONLY=B

# ═══════════════ A: uma conta, 20 PINs errados simultaneos ═══════════════
# (Aqui o rpc_guard ja enfileira as chamadas da MESMA conta pela linha do contador de chamadas; vale como regressao.)
if [[ "$ONLY" == *A* ]]; then
CODE_A="$(new_tag)"; new_user 1 >/dev/null
specs=(); for _ in $(seq 1 20); do specs+=("1:w:$CODE_A"); done
fire_batch "$WORK/a" "${specs[@]}"
fails="$(psql_db -c "select fail_count from public.tag_pin_attempts where tag_code = '$CODE_A' and tutor_id = '$(uuid_for 1)'")"
expect "A: contador da conta parou em 5 (no maximo 5 comparacoes de PIN)" "5" "$fails"
expect "A: as 20 chamadas devolveram wrong_pin (ate 4) ou locked" "20" "$(( $(tally "$WORK/a" wrong_pin) + $(tally "$WORK/a" locked) ))"
fire_batch "$WORK/a2" "1:r:$CODE_A"
expect "A: o PIN CERTO durante o bloqueio devolve locked" "1" "$(tally "$WORK/a2" locked)"
expect "A: a tag segue disponivel" "available" "$(tag_row "$CODE_A" | cut -d'|' -f1)"
fi

# ═══════════════ B: contas DIFERENTES na mesma tag, faltando 1 erro para travar a tag ═══════════════
# Contas diferentes nao se enfileiram pelo rpc_guard: so o FOR UPDATE da tag as serializa. Sem a releitura do bloqueio depois
# dele, as 8 passam pela checagem inicial e cada uma compara um PIN (o contador passaria de 20).
if [[ "$ONLY" == *B* ]]; then
CODE_B="$(new_tag)"; specs=()
psql_db >/dev/null <<SQL
UPDATE public.tag_codes SET pin_fail_count_24h = 19, pin_fail_window_start = now() WHERE code = '$CODE_B';
SQL
for n in 11 12 13 14 15 16 17 18; do new_user "$n" >/dev/null; specs+=("$n:w:$CODE_B"); done
new_user 19 >/dev/null
fire_batch "$WORK/b" "${specs[@]}"
row="$(tag_row "$CODE_B")"
expect "B: o contador da tag parou em exatamente 20 (so 1 comparacao depois de 19)" "20" "$(echo "$row" | cut -d'|' -f2)"
expect "B: a tag travou para todos" "true" "$(echo "$row" | cut -d'|' -f3)"
expect "B: as 8 chamadas devolveram locked" "8" "$(tally "$WORK/b" locked)"
fire_batch "$WORK/b2" "19:r:$CODE_B"
expect "B: o PIN certo de outra conta durante a trava da tag devolve locked" "1" "$(tally "$WORK/b2" locked)"
expect "B: a tag segue disponivel" "available" "$(tag_row "$CODE_B" | cut -d'|' -f1)"
fi

# ═══════════════ C: PIN certo no meio dos errados, contas diferentes, faltando 1 erro para travar a tag ═══════════════
# Invariante: se o bloqueio da tag foi gravado, a tag NAO pode ter sido ativada depois dele. (Se um PIN certo entrar antes do
# bloqueio, a tag vira `assigned` e as demais recebem tag_unavailable: nenhum bloqueio e gravado.)
if [[ "$ONLY" == *C* ]]; then
for round in 1 2 3 4; do
  code="$(new_tag)"; specs=()
  psql_db >/dev/null <<SQL
UPDATE public.tag_codes SET pin_fail_count_24h = 19, pin_fail_window_start = now() WHERE code = '$code';
SQL
  for k in 1 2 3 4 5 6 7 8; do
    n=$((100 * round + k)); new_user "$n" >/dev/null
    if [ $((k % 2)) -eq 0 ]; then specs+=("$n:r:$code"); else specs+=("$n:w:$code"); fi
  done
  fire_batch "$WORK/c$round" "${specs[@]}"
  status="$(tag_row "$code" | cut -d'|' -f1)"
  locked_evt="$(psql_db -c "select count(*) from public.audit_log where event = 'activation_locked_tag' and entity_id = '$code'")"
  if [ "$status" = "assigned" ] && [ "$locked_evt" != "0" ]; then
    fail "C$round: a tag foi ativada DEPOIS de a tag ser bloqueada (PIN certo furou o bloqueio)"
  elif [ "$status" = "available" ] && [ "$(tally "$WORK/c$round" ok)" != "0" ]; then
    fail "C$round: tag disponivel mas uma chamada respondeu ok (inconsistente)"
  else
    pass "C$round: sem ativacao depois do bloqueio (status=$status, bloqueios da tag gravados=$locked_evt)"
  fi
done
fi

exit "$FAILED"
