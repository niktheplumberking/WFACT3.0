#!/usr/bin/env bash
# Step 21 H: replay every migration on a THROWAWAY local Supabase database, then run every machine-checked RLS attack
# script against it. Never points at the live project: it refuses any database that is not on 127.0.0.1/localhost.
#
#   scripts/rls-attack-local.sh postgresql://postgres:postgres@127.0.0.1:54322/postgres
#   PSQL="docker exec -i supabase_db_<project> psql -U postgres -d postgres" scripts/rls-attack-local.sh
#
# Each attack script defines a pg_temp function returning [{t, expect, got}, ...] and rolls back everything it wrote.
# The runner sources the script in one session, then counts the checks whose got differs from expect. A check that
# needs a live-only row reports got "SKIPPED: ..." on a fresh database; it is listed as NOT COVERED here, not passed.
# scripts/rls_attack_test.sql (Phase 2) is a hand-read script with no expect/got rows, so it is not run here.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PSQL:-}" ]; then
  url="${1:?usage: rls-attack-local.sh <local postgres URL>  (or set PSQL)}"
  case "$url" in
    postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) ;;
    *) echo "refusing: $url is not a local database (this script only runs against a throwaway local stack)" >&2; exit 2 ;;
  esac
  PSQL="psql $url"
fi
run() { $PSQL -X -q -v ON_ERROR_STOP=1 "$@"; }

for f in packages/db/migrations/*.sql; do
  { echo 'set client_min_messages = warning;'; cat "$f"; } | run > /dev/null || { echo "FAIL: migration $f did not apply" >&2; exit 1; }
done
echo "migrations applied: $(ls packages/db/migrations/*.sql | wc -l | tr -d ' ')"

failed=0
for f in scripts/rls_attack_test_*.sql; do
  fn=$(grep -oE 'function pg_temp\.[a-z_]+\(' "$f" | head -1 | sed -E 's/function pg_temp\.//; s/\($//')
  if [ -z "$fn" ]; then echo "FAIL: $f defines no pg_temp check function" >&2; failed=1; continue; fi
  skip="coalesce(e->>'got', '') like 'SKIPPED%'"
  bad="e->'expect' is distinct from e->'got' and not ($skip)"
  out=$( { echo 'set client_min_messages = warning;'; echo '\o /dev/null'; cat "$f"; echo; echo '\o'; echo "select count(*) filter (where $bad) || '/' || count(*) || '/' || count(*) filter (where $skip) || ' ' || coalesce(jsonb_agg(e) filter (where $bad or $skip), '[]')::text from jsonb_array_elements(pg_temp.$fn()) e;"; } | run -At 2>&1 ) || { echo "FAIL: $f errored: $out" >&2; failed=1; continue; }
  nbad=${out%%/*}; rest=${out#*/}; total=${rest%%/*}; rest=${rest#*/}; nskip=${rest%% *}
  if [ "$nbad" = "0" ] && [ "$total" -gt 0 ]; then
    echo "PASS $(basename "$f"): $((total - nskip))/$total$([ "$nskip" != 0 ] && echo ", NOT COVERED here (needs live rows): ${rest#* }")"
  else
    echo "FAIL $(basename "$f"): $nbad of $total checks differ: ${rest#* }" >&2
    failed=1
  fi
done
exit $failed
