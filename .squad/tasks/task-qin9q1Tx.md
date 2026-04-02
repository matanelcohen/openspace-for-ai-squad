---
id: task-qin9q1Tx
title: Add limit/offset pagination to cron and memories API endpoints
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-bpwheDT9'
created: '2026-04-02T02:23:17.305Z'
updated: '2026-04-02T02:51:41.886Z'
sortIndex: 648
parent: task-bpwheDT9
---
Add limit/offset query params to the cron and memories REST endpoints, following the existing skill-gallery pattern as reference.

**Reference implementation**: `apps/api/src/routes/skill-gallery.ts` lines 108-119 — shows limit/offset parsing with defaults and clamping.

**Cron endpoints** (`apps/api/src/routes/cron.ts`):
- `GET /api/cron` — currently returns `app.cronService.listJobs()` unbounded. Add `?limit=N&offset=N` params (default limit=50, max=100, default offset=0). Return `{ jobs: CronJob[], total: number }`.
- `GET /api/cron/executions` — already has a hardcoded limit param. Formalize with limit/offset and return total count.

**Memories endpoint** (`apps/api/src/routes/memories.ts`):
- `GET /api/memories` — currently returns full `Memory[]` unbounded. Add `?limit=N&offset=N` params (default limit=50, max=100, default offset=0). Return `{ memories: Memory[], total: number }`.
- `POST /api/memories/search` — also potentially unbounded; add limit/offset to search request body.

**Response format** (match gallery pattern):
```typescript
{ items: T[], total: number }
```

**Important**: The data layer uses SQLite (better-sqlite3) with `.squad/` files as source of truth. Tasks are fetched via `app.squadParser.getTasks()`, memories via memory service. You may need to add pagination at the service layer (array slicing for in-memory lists, or LIMIT/OFFSET for SQLite queries). Check if memories come from SQLite or file system.

**Files to modify**:
- `apps/api/src/routes/cron.ts`
- `apps/api/src/routes/memories.ts`
- Possibly service files under `apps/api/src/services/`

---
**[2026-04-02 02:23:17]** 🚀 Bender started working on this task.
**[2026-04-02 02:23:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:51:41]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
