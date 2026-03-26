#!/usr/bin/env bash
# task-board.sh — CLI tool to manage the openspace.ai task board via API
# Usage:
#   task-board.sh create --title "Fix bug" [--desc "..."] [--status backlog] [--priority P2] [--assignee bender] [--labels "bug,urgent"]
#   task-board.sh list [--status backlog] [--assignee bender] [--priority P1]
#   task-board.sh get <task-id>
#   task-board.sh update <task-id> [--title "..."] [--desc "..."] [--status in-progress] [--priority P1] [--assignee fry] [--labels "a,b"]
#   task-board.sh status <task-id> <new-status>
#   task-board.sh delete <task-id>
#   task-board.sh bulk-create --json '[{"title":"...","status":"backlog"}, ...]'

API_BASE="${TASK_BOARD_API:-http://localhost:3001/api}"

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────

die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "$*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_cmd curl
require_cmd jq

# ── commands ─────────────────────────────────────────────────────────────────

cmd_create() {
  local title="" desc="" status="backlog" priority="P2" assignee="" labels=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)    title="$2";    shift 2 ;;
      --desc)     desc="$2";     shift 2 ;;
      --status)   status="$2";   shift 2 ;;
      --priority) priority="$2"; shift 2 ;;
      --assignee) assignee="$2"; shift 2 ;;
      --labels)   labels="$2";   shift 2 ;;
      *) die "Unknown flag: $1" ;;
    esac
  done

  [[ -z "$title" ]] && die "Flag --title is required"

  local json
  json=$(jq -n \
    --arg title    "$title" \
    --arg desc     "$desc" \
    --arg status   "$status" \
    --arg priority "$priority" \
    --arg assignee "$assignee" \
    --arg labels   "$labels" \
    '{
      title: $title,
      description: (if $desc == "" then null else $desc end),
      status: $status,
      priority: $priority,
      assignee: (if $assignee == "" then null else $assignee end),
      labels: (if $labels == "" then [] else ($labels | split(",") | map(gsub("^\\s+|\\s+$"; ""))) end)
    }')

  curl -s -X POST "$API_BASE/tasks" \
    -H "Content-Type: application/json" \
    -d "$json" | jq .
}

cmd_bulk_create() {
  local json_input=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) json_input="$2"; shift 2 ;;
      *) die "Unknown flag: $1" ;;
    esac
  done

  [[ -z "$json_input" ]] && die "Flag --json is required (JSON array of task objects)"

  local count
  count=$(echo "$json_input" | jq 'length')

  local results="[]"
  for i in $(seq 0 $((count - 1))); do
    local task_json
    task_json=$(echo "$json_input" | jq ".[$i]")

    # Ensure defaults
    task_json=$(echo "$task_json" | jq '{
      title: .title,
      description: (.description // null),
      status: (.status // "backlog"),
      priority: (.priority // "P2"),
      assignee: (.assignee // null),
      labels: (.labels // [])
    }')

    local result
    result=$(curl -s -X POST "$API_BASE/tasks" \
      -H "Content-Type: application/json" \
      -d "$task_json")

    results=$(echo "$results" | jq --argjson r "$result" '. + [$r]')
  done

  echo "$results" | jq .
}

cmd_list() {
  local query=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --status)   query="${query:+$query&}status=$2";   shift 2 ;;
      --assignee) query="${query:+$query&}assignee=$2"; shift 2 ;;
      --priority) query="${query:+$query&}priority=$2"; shift 2 ;;
      *) die "Unknown flag: $1" ;;
    esac
  done

  local url="$API_BASE/tasks"
  [[ -n "$query" ]] && url="$url?$query"

  curl -s "$url" | jq '[.[] | {id, title, status, priority, assignee}]'
}

cmd_get() {
  local id="${1:?Task ID required}"
  curl -s "$API_BASE/tasks/$id" | jq .
}

cmd_update() {
  local id="${1:?Task ID required}"; shift
  local json="{}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)    json=$(echo "$json" | jq --arg v "$2" '. + {title: $v}');       shift 2 ;;
      --desc)     json=$(echo "$json" | jq --arg v "$2" '. + {description: $v}'); shift 2 ;;
      --status)   json=$(echo "$json" | jq --arg v "$2" '. + {status: $v}');      shift 2 ;;
      --priority) json=$(echo "$json" | jq --arg v "$2" '. + {priority: $v}');    shift 2 ;;
      --assignee) json=$(echo "$json" | jq --arg v "$2" '. + {assignee: $v}');    shift 2 ;;
      --labels)   json=$(echo "$json" | jq --arg v "$2" '. + {labels: ($v | split(",") | map(gsub("^\\s+|\\s+$"; "")))}'); shift 2 ;;
      *) die "Unknown flag: $1" ;;
    esac
  done

  curl -s -X PUT "$API_BASE/tasks/$id" \
    -H "Content-Type: application/json" \
    -d "$json" | jq .
}

cmd_status() {
  local id="${1:?Task ID required}"
  local new_status="${2:?New status required (backlog|in-progress|in-review|done|blocked|pending-approval)}"

  curl -s -X PATCH "$API_BASE/tasks/$id/status" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg s "$new_status" '{status: $s}')" | jq .
}

cmd_delete() {
  local id="${1:?Task ID required}"
  curl -s -X DELETE "$API_BASE/tasks/$id" | jq .
}

# ── dispatch ─────────────────────────────────────────────────────────────────

cmd="${1:-}"
shift || true

case "$cmd" in
  create)      cmd_create "$@" ;;
  bulk-create) cmd_bulk_create "$@" ;;
  list)        cmd_list "$@" ;;
  get)         cmd_get "$@" ;;
  update)      cmd_update "$@" ;;
  status)      cmd_status "$@" ;;
  delete)      cmd_delete "$@" ;;
  *)
    echo "Usage: task-board.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create       Create a task (--title, --desc, --status, --priority, --assignee, --labels)"
    echo "  bulk-create  Create multiple tasks (--json '[{...}, ...]')"
    echo "  list         List tasks (--status, --assignee, --priority)"
    echo "  get          Get task detail (task-id)"
    echo "  update       Update a task (task-id, --title, --desc, --status, --priority, --assignee, --labels)"
    echo "  status       Change task status (task-id, new-status)"
    echo "  delete       Delete a task (task-id)"
    exit 1
    ;;
esac
