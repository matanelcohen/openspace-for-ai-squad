---
id: task-hWQUSihZ
title: Create auth middleware plugin and apply to all routes
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-W8qSUffL'
created: '2026-04-02T02:04:48.057Z'
updated: '2026-04-02T02:26:37.492Z'
sortIndex: 599
parent: task-W8qSUffL
---
Create a reusable Fastify preHandler auth middleware that extracts JWT from `Authorization: Bearer <token>`, calls `app.authService.verifyAccessToken()`, and populates `request.user`. Apply it to ALL routes except `/api/auth/*` and `/api/health`. For the terminal WebSocket (`/terminal/ws`), add token verification in the WebSocket upgrade path (the `verifyClient` callback in `apps/api/src/routes/terminal-plugin.ts` line 30). For `/api/memories` GET, add the same preHandler. Audit every route file in `apps/api/src/routes/` — the explore found 25+ route files, all unauthenticated (channels.ts even has a TODO about this). Also normalize pagination: change memories.ts line 244 from `Math.min(Number(limit ?? 500), 1000)` to max 100, matching knowledge.ts's limit. Auth service already exists at `apps/api/src/services/auth/index.ts` with `verifyAccessToken()` ready to use.

---
**[2026-04-02 02:14:12]** 🚀 Bender started working on this task.
**[2026-04-02 02:14:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:26:37]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
