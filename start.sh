#!/usr/bin/env bash
set -e

# ─── openspace.ai — Start Script ────────────────────────────────
# Checks dependencies, installs if needed, starts CLI server + dev servers.
# Usage: ./start.sh          — normal startup
#        ./start.sh doctor   — run diagnostics

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Doctor subcommand ──────────────────────────────────────────
if [ "${1:-}" = "doctor" ]; then
  exec bash scripts/doctor.sh
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[start]${NC} $1"; }
err()  { echo -e "${RED}[start]${NC} $1"; }

# ─── Check Node.js ──────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Install Node 22+ and try again."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  err "Node.js 22+ required (found v$(node -v)). Please upgrade."
  exit 1
fi
log "Node.js $(node -v) ✓"

# ─── Check pnpm ─────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing..."
  npm install -g pnpm
fi
log "pnpm $(pnpm -v) ✓"

# ─── Check Copilot CLI ──────────────────────────────────────────
COPILOT_BIN=$(command -v copilot 2>/dev/null || true)
if [ -z "$COPILOT_BIN" ]; then
  warn "Copilot CLI not found — agents will use mock AI provider."
  SKIP_COPILOT=1
else
  log "Copilot CLI found at $COPILOT_BIN ✓"
  SKIP_COPILOT=0
fi

# ─── Install dependencies if needed ─────────────────────────────
if [ ! -d "node_modules" ] || [ ! -d "apps/web/node_modules" ] || [ ! -d "apps/api/node_modules" ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  log "Dependencies installed ✓"
else
  # Check if lockfile changed since last install
  if [ "pnpm-lock.yaml" -nt "node_modules/.pnpm/lock.yaml" ] 2>/dev/null; then
    log "Lockfile changed, updating dependencies..."
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  else
    log "Dependencies up to date ✓"
  fi
fi

# ─── Clean stale Next.js cache ──────────────────────────────────
if [ -d "apps/web/.next" ]; then
  log "Clearing Next.js cache..."
  rm -rf apps/web/.next
fi

# ─── Kill any existing processes on our ports ────────────────────
for PORT in 3000 3001 3100; do
  PID=$(lsof -ti ":$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    warn "Killing existing process on port $PORT (PID: $PID)"
    kill -9 $PID 2>/dev/null || true
  fi
done
sleep 1

# ─── Load .env for config ───────────────────────────────────────
COPILOT_PORT=${COPILOT_PORT:-3100}
COPILOT_MODEL=${COPILOT_MODEL:-claude-opus-4.6}
API_PORT=${API_PORT:-3001}

# ─── Start Copilot CLI server ───────────────────────────────────
if [ "$SKIP_COPILOT" = "0" ]; then
  log "Starting Copilot CLI server on port $COPILOT_PORT (model: $COPILOT_MODEL)..."
  log "OTLP endpoint configured via SDK (http://localhost:$API_PORT)"
  copilot --headless --port "$COPILOT_PORT" --model "$COPILOT_MODEL" &
  COPILOT_PID=$!
  sleep 2

  if kill -0 $COPILOT_PID 2>/dev/null; then
    log "Copilot CLI server running (PID: $COPILOT_PID) ✓"
  else
    warn "Copilot CLI server failed to start — agents will use mock AI."
  fi
fi

# ─── Start dev servers ──────────────────────────────────────────
log "Starting API + Web dev servers..."
export WATCHPACK_POLLING=true
pnpm dev &
DEV_PID=$!

# ─── Wait and show status ───────────────────────────────────────
sleep 8
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        🚀  openspace.ai is running!          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Web:     http://localhost:3000               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  API:     http://localhost:$API_PORT               ${GREEN}║${NC}"
if [ "$SKIP_COPILOT" = "0" ]; then
echo -e "${GREEN}║${NC}  Copilot: localhost:$COPILOT_PORT (${COPILOT_MODEL})  ${GREEN}║${NC}"
fi
echo -e "${GREEN}║${NC}  LAN:     http://$(ipconfig getifaddr en0 2>/dev/null || echo '?.?.?.?'):3000  ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Traces:  http://localhost:3000/traces         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  A2A:     http://localhost:$API_PORT/.well-known/agent-card.json ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── Handle shutdown ────────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down..."
  kill $DEV_PID 2>/dev/null || true
  [ -n "${COPILOT_PID:-}" ] && kill $COPILOT_PID 2>/dev/null || true
  # Kill remaining processes on our ports
  for PORT in 3000 3001 3100; do
    lsof -ti ":$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  log "Done. Goodbye! 👋"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for dev servers
wait $DEV_PID
