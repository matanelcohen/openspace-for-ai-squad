---
id: task-l5ATSOJR
title: Add debounced search to TraceDetail filter pipeline
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-jWYEfBFS'
created: '2026-04-02T11:11:11.852Z'
updated: '2026-04-02T11:12:10.565Z'
sortIndex: 96
parent: task-jWYEfBFS
---
In trace-detail.tsx, introduce a debouncedSearchQuery state (200-300ms) that decouples the controlled input value (searchQuery) from the value fed into the flatSpans useMemo. Use a useDebounce hook (create one in packages/shared/hooks or use an existing utility) so the expensive filter/sort over all spans only runs after the user stops typing. Keep the input responsive by binding it to the immediate searchQuery, but pass debouncedSearchQuery into the useMemo dependency array.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:12:10]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
