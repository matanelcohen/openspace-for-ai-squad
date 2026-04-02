---
id: task-afF9EMzq
title: Memoize WebSocket provider context value
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-qKQAfY5R'
created: '2026-04-02T11:07:10.507Z'
updated: '2026-04-02T11:11:46.367Z'
sortIndex: 77
parent: task-qKQAfY5R
---
In apps/web websocket-provider.tsx around line 67, the context value object is recreated every render, causing cascading re-renders across the app. Wrap the context value in useMemo with appropriate dependencies (the WebSocket instance, connection state, and any exposed methods). Verify the memoization is correct by ensuring all reactive values are in the dependency array.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:46]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
