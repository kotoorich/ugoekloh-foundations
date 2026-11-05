#!/usr/bin/env bash
# Apply the harness + every migration to the throwaway Postgres container.
# Usage: tools/db.sh [extra.sql]
set -u
C=uf-pg
psql_exec() { sudo -n docker exec -i $C psql -U postgres -d uf -v ON_ERROR_STOP=1 "$@"; }

if [ "${1:-}" = "--fresh" ]; then
  psql_exec -q -c "drop schema if exists public cascade; create schema public;" >/dev/null 2>&1
  shift
fi
sudo -n docker cp tools/pg_harness.sql $C:/tmp/h.sql >/dev/null 2>&1
psql_exec -q -f /tmp/h.sql >/dev/null 2>&1

fail=0
for f in $(ls supabase/migrations/*.sql | sort); do
  sudo -n docker cp "$f" $C:/tmp/m.sql >/dev/null 2>&1
  if ! out=$(psql_exec -q -f /tmp/m.sql 2>&1); then
    echo "MIGRATION FAILED: $(basename "$f")"
    echo "$out" | grep -i error | head -3
    fail=1
  fi
done
[ $fail -eq 0 ] && echo "migrations: OK"

for extra in "$@"; do
  [ -f "$extra" ] || continue
  sudo -n docker cp "$extra" $C:/tmp/x.sql >/dev/null 2>&1
  echo "--- $extra ---"
  if ! out=$(psql_exec -f /tmp/x.sql 2>&1); then echo "FAILED: $extra"; echo "$out" | tail -20; fail=1; fi
done
exit $fail
