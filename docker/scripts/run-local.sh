#!/usr/bin/env bash
# ============================================================================
# run-local.sh — start the full GRC Suite locally WITHOUT Docker
# ============================================================================
# Brings up the three Node apps against an already-running PostgreSQL and wires
# the cross-system sync URLs to localhost. Intended for quick local testing in
# environments where Docker is not available (the canonical path is still
# `docker compose up`).
#
# Usage:
#   ./docker/scripts/run-local.sh start     # build (if needed) + start all 3
#   ./docker/scripts/run-local.sh stop      # stop all 3
#   ./docker/scripts/run-local.sh restart   # stop + start
#   ./docker/scripts/run-local.sh status    # health of all 3
#
# Env overrides (sensible defaults provided):
#   DATABASE_URL   default postgres://grc:grc@127.0.0.1:5432/grc_suite
#   AI_PROVIDER    default none   (set to 'ollama' + OLLAMA_URL for AI)
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://grc:grc@127.0.0.1:5432/grc_suite}"
AI_PROVIDER="${AI_PROVIDER:-none}"
LOG_DIR="${LOG_DIR:-/tmp/grc-suite-logs}"
mkdir -p "$LOG_DIR"

# --- Auth hardening (local) --------------------------------------------------
# Strong, env-driven secrets replace the hardcoded production defaults. These
# are baked into the bundle at build time AND used by the server at runtime, so
# the hardened login (bcrypt + master-password block) is active locally too.
# Override by exporting JWT_SECRET / SYNC_KEY before running.
JWT_SECRET="${JWT_SECRET:-local-dev-jwt-$(hostname)-change-me}"
SYNC_KEY="${SYNC_KEY:-local-dev-sync-$(hostname)-change-me}"
export JWT_SECRET SYNC_KEY

# app:port:schema
APPS=(
  "grc-pulse:3002:grc_pulse"
  "pentest-pulse:3003:pentest_pulse"
  "autoaudit:3001:autoaudit"
)

ensure_built() {
  local app="$1"
  local srv="$ROOT/$app/server"
  if [ ! -d "$srv/node_modules" ]; then
    echo "[$app] installing server deps..."
    (cd "$srv" && npm install --no-audit --no-fund >/dev/null 2>&1)
  fi
  # Copy the canonical adapters into the app's shared dir.
  mkdir -p "$srv/shared"
  cp "$ROOT/docker/shared/d1-pg-adapter.mjs" "$srv/shared/"
  cp "$ROOT/docker/shared/ai-adapter.mjs" "$srv/shared/"
  if [ "$app" = "autoaudit" ]; then
    # AutoAudit is a Vite SPA — build the static bundle if missing.
    if [ ! -f "$ROOT/$app/dist/index.html" ]; then
      echo "[$app] building SPA..."
      (cd "$ROOT/$app" && npm install --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1)
    fi
  else
    # Hono apps — bundle src/index.tsx, wiring the peer sync URL to localhost
    # and baking the strong JWT_SECRET / SYNC_KEY into the bundle so the app's
    # verifier matches the server's session signer.
    echo "[$app] bundling app..."
    if [ "$app" = "grc-pulse" ]; then
      (cd "$srv" && PENTEST_PULSE_URL="http://localhost:3003" \
          JWT_SECRET="$JWT_SECRET" SYNC_KEY="$SYNC_KEY" node build.mjs >/dev/null 2>&1)
    else
      (cd "$srv" && GRC_PULSE_URL="http://localhost:3002" \
          JWT_SECRET="$JWT_SECRET" SYNC_KEY="$SYNC_KEY" node build.mjs >/dev/null 2>&1)
    fi
  fi
}

start() {
  for entry in "${APPS[@]}"; do
    IFS=":" read -r app port schema <<<"$entry"
    ensure_built "$app"
    local srv="$ROOT/$app/server"
    local extra=""
    [ "$app" = "pentest-pulse" ] && extra="EVIDENCE_DIR=/tmp/evidence"
    echo "[$app] starting on :$port (schema=$schema)"
    ( cd "$srv" && env DATABASE_URL="$DATABASE_URL" DB_SCHEMA="$schema" PORT="$port" \
        AI_PROVIDER="$AI_PROVIDER" JWT_SECRET="$JWT_SECRET" SYNC_KEY="$SYNC_KEY" \
        $extra nohup node server.mjs >"$LOG_DIR/$app.log" 2>&1 & )
  done
  sleep 4
  status
}

stop() {
  for entry in "${APPS[@]}"; do
    IFS=":" read -r app port schema <<<"$entry"
    local pid
    pid="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1 || true)"
    if [ -n "${pid:-}" ]; then kill -9 "$pid" 2>/dev/null || true; echo "[$app] stopped (pid $pid)"; fi
  done
}

status() {
  for entry in "${APPS[@]}"; do
    IFS=":" read -r app port schema <<<"$entry"
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/healthz" || echo 000)"
    # 302 = healthy (auth redirect) for pentest
    echo "[$app] :$port -> HTTP $code"
  done
}

case "${1:-start}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 2; start ;;
  status)  status ;;
  *) echo "usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac
