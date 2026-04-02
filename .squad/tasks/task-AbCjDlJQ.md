---
id: task-AbCjDlJQ
title: Fix setInterval memory leak in ingestion-status
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-Znbz0uwv'
created: '2026-04-02T02:20:41.588Z'
updated: '2026-04-02T02:57:08.711Z'
sortIndex: 642
parent: task-Znbz0uwv
---
In apps/**/ingestion-status.tsx around lines 69-77, the setInterval for polling is never cleared on unmount or when ingestion completes, and multiple handleIngest calls stack intervals. Fix by: (1) creating a useRef<NodeJS.Timeout | null> to store the interval ID, (2) clearing the previous interval at the start of handleIngest before setting a new one, (3) clearing the interval in the useEffect cleanup return, and (4) clearing the interval when ingestion completes (status === 'done' or 'error'). Ensure no interval is left running after the component unmounts.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **lightweight** — Single agent with tools (maxAgents: 1)

---
**[2026-04-02 02:57:08]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
