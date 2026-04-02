---
id: task-DN-ty4y5
title: Fix timer leak and dead code in ingestion-status.tsx
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Xh6T9Wt2'
created: '2026-04-02T11:14:44.583Z'
updated: '2026-04-02T11:17:21.278Z'
sortIndex: 101
parent: task-Xh6T9Wt2
---
In `ingestion-status.tsx`, `handleIngest` creates two competing `setTimeout`s (5s and 120s) that both clear the same interval and call `setIngesting(false)`. The 5s timeout fires first, making the 120s timeout dead code. Additionally, if the component unmounts before timers fire, all timers leak and call `refetch`/`setState` on an unmounted component.

Fix:
1. Remove the redundant 120s timeout entirely — it's dead code since the 5s timeout always fires first.
2. Consolidate to a single polling strategy: keep the interval for polling and a single timeout as a safety net (e.g. 120s max polling duration).
3. Wrap the entire polling setup in a `useEffect` cleanup pattern: store all timer IDs (both `setInterval` and `setTimeout`) and clear them all on unmount.
4. Use an abort flag or ref (`isMounted` ref) so that if the component unmounts, the interval callback skips `refetch()` and `setIngesting(false)` calls.
5. Make sure `setIngesting(false)` and interval cleanup only happen once, not from multiple competing code paths.

---
**[2026-04-02 11:17:13]** 🚀 Fry started working on this task.
**[2026-04-02 11:17:13]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:17:21]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
