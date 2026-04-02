---
id: task-fxRNGsoi
title: Add 300ms debounce to search inputs
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-DylQFu5h'
created: '2026-04-02T02:07:01.495Z'
updated: '2026-04-02T02:22:29.928Z'
sortIndex: 610
parent: task-DylQFu5h
---
Search inputs in these files trigger expensive filtering on every keystroke with no debounce: `trace-detail.tsx`, `trace-list.tsx`, `memory-search.tsx`, and `task-filters-toolbar.tsx` (all under apps/web). Replicate the debounce pattern already used in `use-decision-search.ts` (300ms delay). For each file:
1. Find the search/filter input's onChange handler that directly sets state or calls a filter function.
2. Wrap the callback with a 300ms debounce — either extract a shared `useDebouncedCallback` hook or use the same approach as `use-decision-search.ts`.
3. Make sure the displayed input value updates immediately (controlled input) while the actual filter/search fires on the debounced value.
4. If a shared hook doesn't exist yet, create `use-debounced-value.ts` (or similar) in the hooks directory so all four files use the same utility.

---
**[2026-04-02 02:07:01]** 🚀 Fry started working on this task.
**[2026-04-02 02:07:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:22:29]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
