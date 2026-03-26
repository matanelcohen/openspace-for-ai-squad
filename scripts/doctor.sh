#!/usr/bin/env bash
# ─── openspace.ai — Doctor ──────────────────────────────────────
# Diagnostic checks for the openspace.ai development environment.
# Usage: ./scripts/doctor.sh  (or: ./start.sh doctor)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

ok()   { echo -e "  ${GREEN}[✓]${NC} $1"; PASS=$((PASS + 1)); }
warn() { echo -e "  ${YELLOW}[!]${NC} $1"; WARN=$((WARN + 1)); }
fail() { echo -e "  ${RED}[✗]${NC} $1"; FAIL=$((FAIL + 1)); }

echo ""
echo -e "${BOLD}🩺 openspace.ai — Doctor${NC}"
echo -e "${BOLD}────────────────────────────────────────────${NC}"
echo ""

# ─── Node.js ────────────────────────────────────────────────────
echo -e "${BOLD}Runtime${NC}"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ]; then
    ok "Node.js $NODE_VER"
  else
    fail "Node.js $NODE_VER (22+ required)"
  fi
else
  fail "Node.js not installed"
fi

# ─── pnpm ───────────────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm -v)"
else
  fail "pnpm not installed"
fi

# ─── Copilot CLI ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Copilot CLI${NC}"
COPILOT_BIN=$(command -v copilot 2>/dev/null || true)
if [ -n "$COPILOT_BIN" ]; then
  ok "Copilot CLI at $COPILOT_BIN"
else
  warn "Copilot CLI not found (agents will use mock AI)"
fi

# ─── Copilot CLI server ────────────────────────────────────────
COPILOT_PORT=${COPILOT_PORT:-3100}
if lsof -ti ":$COPILOT_PORT" &>/dev/null 2>&1; then
  ok "Copilot CLI server running on port $COPILOT_PORT"
else
  warn "Copilot CLI server not running on port $COPILOT_PORT"
fi

# ─── API server ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Servers${NC}"
API_PORT=${API_PORT:-3001}
if lsof -ti ":$API_PORT" &>/dev/null 2>&1; then
  ok "API server running on port $API_PORT"
else
  warn "API server not running on port $API_PORT"
fi

# ─── Web server ─────────────────────────────────────────────────
WEB_PORT=3000
if lsof -ti ":$WEB_PORT" &>/dev/null 2>&1; then
  ok "Web server running on port $WEB_PORT"
else
  warn "Web server not running on port $WEB_PORT"
fi

# ─── SQLite DB ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Data${NC}"
SQUAD_DIR="${SQUAD_DIR:-.squad}"
DB_PATH="$SQUAD_DIR/openspace.db"
if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(du -h "$DB_PATH" 2>/dev/null | cut -f1 | tr -d ' ')
  ok "SQLite database exists ($DB_PATH, ${DB_SIZE})"
else
  warn "SQLite database not found at $DB_PATH (created on first API start)"
fi

# ─── .squad/ directory ──────────────────────────────────────────
echo ""
echo -e "${BOLD}Squad Structure${NC}"
if [ -d "$SQUAD_DIR" ]; then
  ok ".squad/ directory exists"
else
  fail ".squad/ directory missing"
fi

# team.md
if [ -f "$SQUAD_DIR/team.md" ]; then
  MEMBER_COUNT=$(grep -c '|.*|.*|.*|' "$SQUAD_DIR/team.md" 2>/dev/null || echo 0)
  MEMBER_COUNT=$((MEMBER_COUNT > 1 ? MEMBER_COUNT - 1 : 0))  # subtract header
  ok ".squad/team.md parseable ($MEMBER_COUNT members)"
else
  fail ".squad/team.md missing"
fi

# Skills directory
if [ -d "$SQUAD_DIR/skills" ]; then
  SKILL_COUNT=0
  for skill_dir in "$SQUAD_DIR/skills"/*/; do
    if [ -f "${skill_dir}SKILL.md" ]; then
      SKILL_COUNT=$((SKILL_COUNT + 1))
    fi
  done
  if [ "$SKILL_COUNT" -gt 0 ]; then
    ok ".squad/skills/ has $SKILL_COUNT valid SKILL.md files"
  else
    warn ".squad/skills/ exists but no valid SKILL.md files found"
  fi
else
  warn ".squad/skills/ directory missing"
fi

# Agents directory
if [ -d "$SQUAD_DIR/agents" ]; then
  AGENT_COUNT=$(find "$SQUAD_DIR/agents" -name "charter.md" 2>/dev/null | wc -l | tr -d ' ')
  ok ".squad/agents/ has $AGENT_COUNT agent charters"
else
  warn ".squad/agents/ directory missing"
fi

# ─── Environment variables ──────────────────────────────────────
echo ""
echo -e "${BOLD}Environment${NC}"
if [ -n "${COPILOT_CLI_URL:-}" ]; then
  ok "COPILOT_CLI_URL=$COPILOT_CLI_URL"
else
  warn "COPILOT_CLI_URL not set (defaults to subprocess mode)"
fi

if [ -n "${COPILOT_MODEL:-}" ]; then
  ok "COPILOT_MODEL=$COPILOT_MODEL"
else
  warn "COPILOT_MODEL not set (using default: claude-opus-4.6)"
fi

if [ -n "${AI_PROVIDER:-}" ]; then
  ok "AI_PROVIDER=$AI_PROVIDER"
else
  warn "AI_PROVIDER not set (defaults to copilot-sdk)"
fi

# ─── Dependencies ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}Dependencies${NC}"
if [ -d "node_modules" ] && [ -d "apps/api/node_modules" ] && [ -d "apps/web/node_modules" ]; then
  ok "node_modules installed"
else
  fail "node_modules missing — run: pnpm install"
fi

# ─── Summary ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────────${NC}"
TOTAL=$((PASS + WARN + FAIL))
echo -e "  ${GREEN}$PASS passed${NC}  ${YELLOW}$WARN warnings${NC}  ${RED}$FAIL failed${NC}  (${TOTAL} checks)"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Some checks failed — fix the issues above.${NC}"
  echo ""
  exit 1
else
  echo -e "  ${GREEN}Environment looks good! 🚀${NC}"
  echo ""
  exit 0
fi
