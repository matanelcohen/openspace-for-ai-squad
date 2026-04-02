---
id: task-B7yICiZl
title: Fix timer leaks in ingestion-status.tsx
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-BDY-iVAs'
created: '2026-04-02T02:16:47.880Z'
updated: '2026-04-02T02:56:34.444Z'
sortIndex: 631
parent: task-BDY-iVAs
---
In `apps/web/src/components/ingestion-status.tsx`, the `handleIngest()` function creates a `setInterval` (3s poll) and two competing `setTimeouts` (5s and 120s) with no cleanup on unmount. Fix this by: (1) Store all timer IDs in a `useRef` (e.g., `timersRef = useRef<{ interval?: number; timeout?: number }>({})`). (2) Consolidate the dual 5s/120s `setTimeout` calls into a single timeout (120s max, with the polling interval itself detecting completion). (3) Add a cleanup function in the `useEffect` (or in the component's unmount path) that calls `clearInterval` and `clearTimeout` on all tracked timers. (4) Add an `isMounted` guard (via ref or AbortController) so that async callbacks don't call `setIngesting(false)` after unmount. (5) Make sure the polling `setInterval` is also cleared when ingestion completes successfully, not just on timeout. The race condition where ingestion appears done after 5s but the 120s timer later re-sets state must be eliminated.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:34]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
