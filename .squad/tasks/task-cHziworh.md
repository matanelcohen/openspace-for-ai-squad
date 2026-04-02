---
id: task-cHziworh
title: Add server-side pagination to list API endpoints
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-Tf8qZCMT'
created: '2026-04-02T01:26:47.525Z'
updated: '2026-04-02T02:05:50.591Z'
sortIndex: 574
parent: task-Tf8qZCMT
---
Add offset/limit pagination to the backend API endpoints:

1. **GET /api/traces** — already has `limit` param, add `offset` param. Update `traceService.listTraces()` to accept offset and return `{ data, total }` envelope.
2. **GET /api/tasks** — add `limit` and `offset` query params. Update the handler in `apps/api/src/routes/tasks.ts` (line ~53-74) to slice after filtering.
3. **GET /api/workflows** — this endpoint doesn't exist yet on the backend but frontend calls it. Create it in the routes with pagination support, reading from `.squad/templates/workflows/`.

All endpoints should return `{ data: T[], total: number, limit: number, offset: number }` response shape. Default limit=50, max limit=100.

---
**[2026-04-02 01:31:54]** 🚀 Bender started working on this task.
**[2026-04-02 01:31:54]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 01:41:57]** 🚀 Bender started working on this task.
**[2026-04-02 01:41:57]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:05:50]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
