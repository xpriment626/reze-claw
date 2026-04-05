#!/usr/bin/env bash
set -euo pipefail

# RezeClaw — unified dev launcher
# Starts Coral server, Reze gateway, and Tauri frontend with health-check gating.
# Ctrl+C kills all three cleanly.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REZE_DIR="$ROOT_DIR/agents/reze"

CORAL_PORT=5555
REZE_PORT=3001
CORAL_AUTH_TOKEN="${CORAL_AUTH_TOKEN:-ligma}"

# Track child PIDs for cleanup
PIDS=()

cleanup() {
  trap - SIGINT SIGTERM EXIT
  echo ""
  echo "[dev] Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "[dev] Done."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

wait_for_port() {
  local port=$1
  local name=$2
  local max_wait=${3:-60}
  local elapsed=0

  while ! curl -s -o /dev/null -w "" "http://127.0.0.1:$port" 2>/dev/null; do
    if [ $elapsed -ge $max_wait ]; then
      echo "[dev] ERROR: $name did not start within ${max_wait}s"
      exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "[dev] $name is up (port $port, ${elapsed}s)"
}

# --- 1. Coral Server (via npx) ---
# Coral server requires Java 24+; find it regardless of current JAVA_HOME
CORAL_JAVA="$(/usr/libexec/java_home -v 24+ 2>/dev/null || true)"
if [ -z "$CORAL_JAVA" ]; then
  echo "[dev] ERROR: Java 24+ required for Coral server but not found."
  echo "[dev] Install via: brew install openjdk"
  exit 1
fi
export JAVA_HOME="$CORAL_JAVA"
export PATH="$JAVA_HOME/bin:$PATH"
echo "[dev] Starting Coral server via npx (JAVA_HOME=${JAVA_HOME:-system default})..."
cd "$ROOT_DIR"
CONFIG_FILE_PATH=./coral.config.toml npx coral-server@1.1.0 start \
  --registry.local-agents="$ROOT_DIR/agents/*" &>/tmp/coral-server-dev.log &
PIDS+=($!)
wait_for_port $CORAL_PORT "Coral" 120

# --- 2. Reze Gateway ---
echo "[dev] Starting Reze gateway..."
cd "$REZE_DIR"
CORAL_API_URL="http://localhost:$CORAL_PORT" \
CORAL_AUTH_TOKEN="$CORAL_AUTH_TOKEN" \
npx tsx src/index.ts &>/tmp/reze-dev.log &
PIDS+=($!)
wait_for_port $REZE_PORT "Reze" 15

# --- 3. Tauri Frontend ---
echo "[dev] Starting Tauri frontend..."
cd "$ROOT_DIR"
pnpm tauri dev 2>&1 &
PIDS+=($!)

echo ""
echo "[dev] All services running:"
echo "  Coral:    http://localhost:$CORAL_PORT/ui/console"
echo "  Reze:     http://localhost:$REZE_PORT/health"
echo "  Frontend: Tauri desktop app"
echo ""
echo "  Logs: /tmp/coral-server-dev.log, /tmp/reze-dev.log"
echo "  Press Ctrl+C to stop all"
echo ""

# Wait for any child to exit
wait
