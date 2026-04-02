---
id: task-LUQgMgkp
title: Test auth middleware rejects unauthenticated requests
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-8LsB9WUz'
created: '2026-04-02T10:54:46.235Z'
updated: '2026-04-02T11:03:15.512Z'
sortIndex: 54
parent: task-8LsB9WUz
dependsOn:
  - task-TL-2ju-t
---
Write integration tests verifying: (1) All protected endpoints return 401 when no token is provided — specifically test GET /agents, POST /sandboxes/:id/exec, GET /workspaces/browse, and /channels routes. (2) Requests with an invalid/expired JWT return 401. (3) Requests with a valid JWT succeed (200/expected status). (4) Public routes (/health, auth endpoints) remain accessible without a token. (5) Test that the preHandler doesn't break existing route functionality when a valid token is supplied. Use the existing test framework (vitest based on vitest.config.ts at repo root). Place tests near the existing API test files or in apps/api/src/__tests__/.

---
**[2026-04-02 11:00:50]** 🚀 Zoidberg started working on this task.
**[2026-04-02 11:00:50]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:03:15]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
