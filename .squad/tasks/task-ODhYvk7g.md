---
id: task-ODhYvk7g
title: Add signal support to apiClient and hook queryFn calls
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-d3UsTeDu'
created: '2026-04-02T02:21:54.695Z'
updated: '2026-04-02T02:57:13.481Z'
sortIndex: 645
parent: task-d3UsTeDu
---
Modify the shared apiClient() function in api-client.ts to accept an optional AbortSignal parameter and pass it through to every fetch() call. Then update all useQuery and useMutation queryFn callbacks across the codebase to forward the signal provided by TanStack Query (it's available as queryFn({ signal })). This ensures every HTTP request is automatically abortable when queries are cancelled or components unmount. Search for all usages of apiClient( and ensure each one threads the signal through.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:57:13]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
