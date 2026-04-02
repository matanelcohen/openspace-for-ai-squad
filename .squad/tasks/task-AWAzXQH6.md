---
id: task-AWAzXQH6
title: Register @fastify/helmet in the API
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-dLYeZD2w'
created: '2026-04-02T10:37:30.449Z'
updated: '2026-04-02T10:55:35.908Z'
sortIndex: 35
parent: task-dLYeZD2w
---
Install @fastify/helmet and register it in the Fastify API (apps/api/src/app.ts or equivalent). Configure it to set X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Content-Security-Policy (strict policy appropriate for an API — default-src 'none'), and Strict-Transport-Security: max-age=31536000; includeSubDomains. Ensure the helmet plugin is registered early in the plugin chain so all routes get the headers. Run the existing API tests to confirm nothing breaks.

---
**[2026-04-02 10:51:22]** 🚀 Bender started working on this task.
**[2026-04-02 10:51:22]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 10:55:35]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
