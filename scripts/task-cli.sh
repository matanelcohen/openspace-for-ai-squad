#!/usr/bin/env bash
# task-cli.sh — CLI tool for managing tasks on the openspace.ai board
# API server must be running on localhost:3001
#
# Usage:
#   ./scripts/task-cli.sh create --title "Fix bug" --desc "Details" --priority P1
#   ./scripts/task-cli.sh list [--status backlog] [--assignee fry]
#   ./scripts/task-cli.sh update-status <task-id> <status>
#   ./scripts/task-cli.sh get <task-id>
#   ./scripts/task-cli.sh delete <task-id>
#   ./scripts/task-cli.sh batch-create < tasks.json

set -euo pipefail

API_BASE="${TASK_API_URL:-http://localhost:3001}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }

api_post() {
  local path="$1" body="$2"
  curl -sf -X POST "${API_BASE}${path}" \
    -H 'Content-Type: application/json' \
    -d "$body"
}

api_get() {
  curl -sf "${API_BASE}$1"
}

api_patch() {
  local path="$1" body="$2"
  curl -sf -X PATCH "${API_BASE}${path}" \
    -H 'Content-Type: application/json' \
    -d "$body"
}

api_delete() {
  curl -sf -X DELETE "${API_BASE}$1" -o /dev/null -w "%{http_code}"
}

# ─── Commands ────────────────────────────────────────────────────────────────

cmd_create() {
  local title="" desc="" priority="P1" assignee="null" labels="[]" status="backlog"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)    title="$2";    shift 2 ;;
      --desc)     desc="$2";     shift 2 ;;
      --priority) priority="$2"; shift 2 ;;
      --assignee) assignee="\"$2\""; shift 2 ;;
      --labels)   labels="$2";   shift 2 ;;
      --status)   status="$2";   shift 2 ;;
      *) die "Unknown flag: $1" ;;
    esac
  done

  [[ -z "$title" ]] && die "Missing --title"

  local body
  body=$(cat <<EOF
{
  "title": $(printf '%s' "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "description": $(printf '%s' "$desc" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
  "priority": "$priority",
  "assignee": $assignee,
  "labels": $labels,
  "status": "$status"
}
EOF
)

  local result
  result=$(api_post "/api/tasks" "$body") || die "Failed to create task"
  echo "$result" | python3 -m json.tool
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

  local url="/api/tasks"
  [[ -n "$query" ]] && url="${url}?${query}"

  api_get "$url" | python3 -c "
import json, sys
tasks = json.load(sys.stdin)
if not tasks:
    print('No tasks found.')
    sys.exit(0)
print(f'Found {len(tasks)} task(s):')
print()
for t in tasks:
    status = t.get('status','?')
    prio = t.get('priority','?')
    assignee = t.get('assignee') or 'unassigned'
    print(f\"  [{prio}] {t['id']}  {status:<16} {assignee:<12} {t['title']}\")
"
}

cmd_get() {
  [[ $# -lt 1 ]] && die "Usage: task-cli.sh get <task-id>"
  api_get "/api/tasks/$1" | python3 -m json.tool
}

cmd_update_status() {
  [[ $# -lt 2 ]] && die "Usage: task-cli.sh update-status <task-id> <status>"
  local task_id="$1" status="$2"
  api_patch "/api/tasks/${task_id}/status" "{\"status\":\"$status\"}" | python3 -m json.tool
}

cmd_delete() {
  [[ $# -lt 1 ]] && die "Usage: task-cli.sh delete <task-id>"
  local code
  code=$(api_delete "/api/tasks/$1")
  if [[ "$code" == "204" ]]; then
    echo "✅ Deleted task $1"
  else
    die "Failed to delete task $1 (HTTP $code)"
  fi
}

cmd_batch_create() {
  # Reads JSON array from stdin: [{"title":"...","description":"...","priority":"P1","assignee":null,"labels":[]}, ...]
  python3 -c "
import json, sys, subprocess

tasks = json.load(sys.stdin)
if not isinstance(tasks, list):
    print('❌ Expected a JSON array of tasks', file=sys.stderr)
    sys.exit(1)

base = '${API_BASE}'
created = 0
for t in tasks:
    body = json.dumps({
        'title': t.get('title', ''),
        'description': t.get('description', ''),
        'priority': t.get('priority', 'P1'),
        'assignee': t.get('assignee'),
        'labels': t.get('labels', []),
        'status': t.get('status', 'backlog'),
    })
    r = subprocess.run(
        ['curl', '-sf', '-X', 'POST', f'{base}/api/tasks',
         '-H', 'Content-Type: application/json', '-d', body],
        capture_output=True, text=True
    )
    if r.returncode == 0:
        result = json.loads(r.stdout)
        print(f\"  ✅ Created: [{result.get('priority','?')}] {result['id']}  {result['title']}\")
        created += 1
    else:
        print(f\"  ❌ Failed: {t.get('title','?')} — {r.stderr}\", file=sys.stderr)

print(f'\nCreated {created}/{len(tasks)} tasks.')
"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift || true

case "$cmd" in
  create)        cmd_create "$@" ;;
  list)          cmd_list "$@" ;;
  get)           cmd_get "$@" ;;
  update-status) cmd_update_status "$@" ;;
  delete)        cmd_delete "$@" ;;
  batch-create)  cmd_batch_create ;;
  help|--help|-h)
    echo "Usage: task-cli.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create         Create a task  (--title, --desc, --priority, --assignee, --labels, --status)"
    echo "  list           List tasks     (--status, --assignee, --priority)"
    echo "  get <id>       Get task detail"
    echo "  update-status <id> <status>   Change task status"
    echo "  delete <id>    Delete a task"
    echo "  batch-create   Create tasks from JSON array on stdin"
    echo ""
    echo "Statuses: pending-approval, backlog, in-progress, in-review, done, blocked"
    echo "Priorities: P0, P1, P2, P3"
    ;;
  *) die "Unknown command: $cmd. Run with --help for usage." ;;
esac
