---
id: task-jqmTK373
title: Create useLiveTimer hook and fix stale timers
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-vT8YwDLA'
created: '2026-04-02T02:16:14.403Z'
updated: '2026-04-02T02:56:26.414Z'
sortIndex: 629
parent: task-vT8YwDLA
---
In `apps/web/app/page.tsx` (lines ~128-131 and ~188), the 'Last scan: Xs ago' and 'Next in: Xs' labels compute their values with `Date.now()` at render time but never trigger re-renders, so they freeze immediately. Fix:
1. Create a `useLiveTimer` custom hook (e.g., `apps/web/hooks/useLiveTimer.ts`) that uses `useState` + `setInterval(1000)` to return a `now` value that ticks every second. Must clean up the interval on unmount.
2. Replace the static `Date.now()` calls in `app/page.tsx` with the hook's live `now` value so the 'Last scan' and 'Next in' labels update every second.
3. Ensure the hook is SSR-safe (initialize interval only in `useEffect`, not during server render).

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:26]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
