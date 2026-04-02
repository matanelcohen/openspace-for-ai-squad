---
id: task-LQT1TEp0
title: Add cursor-based pagination to API endpoints
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-PpMs5KiZ'
created: '2026-04-02T02:06:49.982Z'
updated: '2026-04-02T02:26:45.620Z'
sortIndex: 606
parent: task-PpMs5KiZ
---
Add cursor-based pagination support to the backend API endpoints that serve traces, memories, and tasks. Each endpoint should accept `cursor` and `limit` query parameters (default limit=50) and return a `nextCursor` field in the response when more items are available. Ensure the cursor is opaque (base64-encoded id or timestamp) and ordering is stable (by createdAt desc). Update the route handlers and any database/service layer queries for all three resources: traces, memories, and tasks.

---
**[2026-04-02 02:14:12]** 🚀 Bender started working on this task.
**[2026-04-02 02:14:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:26:45]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
