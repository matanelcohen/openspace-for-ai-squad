---
id: task-mCP4GVF3
title: Add server-side assignee filter to tasks API
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-c14GSoA7'
created: '2026-04-02T02:19:23.125Z'
updated: '2026-04-02T02:51:30.365Z'
sortIndex: 637
parent: task-c14GSoA7
---
In the backend tasks endpoint, add support for a `?assignee=` query parameter that filters tasks by assignee on the server side. This is needed so the team-members/[id]/page.tsx can stop fetching ALL tasks system-wide just to filter client-side by one assignee. Verify the existing endpoint contract and add the filter logic at the query/database level. Ensure the response shape stays the same — only the filtering changes.

---
**[2026-04-02 02:22:44]** 🚀 Bender started working on this task.
**[2026-04-02 02:22:44]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:51:30]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
