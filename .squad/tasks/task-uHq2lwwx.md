---
id: task-uHq2lwwx
title: Extract useFilteredData hook and shared STATUS_CONFIG constants
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-5__3unpm'
created: '2026-04-02T02:19:50.446Z'
updated: '2026-04-02T02:57:17.678Z'
sortIndex: 639
parent: task-5__3unpm
---
Audit trace-list.tsx, team-members/page.tsx, workflows/page.tsx, and other files with duplicated filter/sort/status logic. Create a shared useFilteredData<T>() hook (likely in packages/shared or a hooks/ directory) that encapsulates filter-by-status, text search, and sort logic with generic typing. Also extract the duplicated STATUS_CONFIG badge color/label maps from trace-list and trace-detail into a single shared constants file. Ensure the hook API is flexible enough to cover all current usage patterns.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:57:17]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
