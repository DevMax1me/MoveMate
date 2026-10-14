#!/usr/bin/env bash
# Lance l'application sur une base temporaire et exécute la recette bout en bout.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3917}"
DB="$(mktemp -d)/e2e.db"
[ -d .next ] || npx next build
if curl -sf "http://localhost:$PORT/api/me" >/dev/null 2>&1; then echo "Le port $PORT est déjà utilisé : arrêtez le serveur existant ou définissez PORT." >&2; exit 1; fi
DATABASE_PATH="$DB" AGENT_DAILY_QUOTA=30 node node_modules/next/dist/bin/next start -p "$PORT" >/tmp/terminator-e2e.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "http://localhost:$PORT/api/me" >/dev/null && break; sleep 0.5; done
E2E_URL="http://localhost:$PORT" npx vitest run tests/e2e.test.ts
