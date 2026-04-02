---
id: task-lJM67VUs
title: Add AbortSignal passthrough to apiClient
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-LevnH79_'
created: '2026-04-02T01:26:13.939Z'
updated: '2026-04-02T02:05:55.232Z'
sortIndex: 571
parent: task-LevnH79_
---
Modify apiClient() in src/lib/api-client.ts to accept an optional AbortSignal parameter and forward it to the underlying fetch() call. Ensure all HTTP methods (GET, POST, PUT, DELETE) support the signal option. Update the TypeScript types/interfaces for the client options accordingly.

---
**[2026-04-02 01:31:54]** 🚀 Bender started working on this task.
**[2026-04-02 01:31:54]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:05:55]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
