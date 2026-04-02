---
id: task-i18a51xn
title: Define Zod schemas and add validated parsing to api-client.ts
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-51Xq8ArW'
created: '2026-04-02T11:08:41.655Z'
updated: '2026-04-02T11:11:28.025Z'
sortIndex: 84
parent: task-51Xq8ArW
---
Install zod if not already present. Create Zod schemas for the critical API response types: cron executions, tasks, and escalations. Look at the existing TypeScript types/interfaces used in api-client.ts and the actual backend response shapes to define accurate schemas. Update the generic fetch/parse logic in api-client.ts so that instead of casting res.json() as T, it runs the response through a Zod schema's .parse() or .safeParse(). Add a validated fetch wrapper that accepts a ZodSchema<T> and returns the parsed, type-safe result — throwing or logging a clear error when the shape doesn't match. Keep backward compatibility for any endpoints that don't yet have schemas.

---
**[2026-04-02 11:11:17]** 🚀 Bender started working on this task.
**[2026-04-02 11:11:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:28]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
