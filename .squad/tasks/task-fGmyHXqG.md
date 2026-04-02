---
id: task-fGmyHXqG
title: Backend cron API validation hardening
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-9SacBWxs'
created: '2026-04-02T02:06:15.504Z'
updated: '2026-04-02T02:26:40.312Z'
sortIndex: 604
parent: task-9SacBWxs
---
In apps/api/src/routes/cron.ts: (1) Add server-side cron expression validation on the POST and PUT /api/cron endpoints — use a cron-expression-validator package or a robust regex to reject invalid cron strings with a 400 response. (2) Add max-length checks matching the frontend constraints (message: 5000, description: 2000, title: 200, agenda: 5000) and return 400 with descriptive errors if exceeded. (3) Validate that participant agent IDs, if provided, reference agents that actually exist by checking against the agent registry/config. Return 400 with the list of invalid IDs if any don't match. (4) Ensure all string inputs are trimmed before storage. Use the existing TypeBox/AJV patterns already in the API for consistency.

---
**[2026-04-02 02:14:12]** 🚀 Bender started working on this task.
**[2026-04-02 02:14:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:26:40]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
