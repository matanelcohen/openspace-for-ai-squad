---
id: task-TL-2ju-t
title: Implement JWT preHandler middleware and protect all API routes
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-8LsB9WUz'
created: '2026-04-02T10:54:46.206Z'
updated: '2026-04-02T11:02:59.254Z'
sortIndex: 52
parent: task-8LsB9WUz
---
Create a Fastify preHandler hook in apps/api that validates JWT/session tokens. The hook should: (1) extract Bearer token from Authorization header, (2) verify the JWT signature and expiration, (3) attach decoded user info to request, (4) return 401 for missing/invalid tokens. Register this hook on all route prefixes: /agents, /skills, /sandboxes, /workspaces, /channels. Define a whitelist for public routes (e.g. /health, /auth/login, /auth/register). Remove the TODO at channels.ts:15 and replace with the actual auth check. Use the existing auth infrastructure if any exists in the codebase, or create a new auth utility in packages/shared or apps/api/src/middleware/. Ensure the /sandboxes/:id/exec and /workspaces/browse endpoints are protected — these are the highest-risk routes.

---
**[2026-04-02 10:55:35]** 🚀 Bender started working on this task.
**[2026-04-02 10:55:35]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:00:50]** 🚀 Bender started working on this task.
**[2026-04-02 11:00:50]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:00:53]** 🚀 Bender started working on this task.
**[2026-04-02 11:00:53]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:01:54]** 🚀 Bender started working on this task.
**[2026-04-02 11:01:54]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:01:56]** 🚀 Bender started working on this task.
**[2026-04-02 11:01:56]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:02:59]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
