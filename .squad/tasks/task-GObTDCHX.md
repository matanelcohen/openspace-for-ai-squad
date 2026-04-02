---
id: task-GObTDCHX
title: Refactor ingestion polling lifecycle
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-diO4GJe8'
created: '2026-04-02T11:07:33.595Z'
updated: '2026-04-02T11:12:13.334Z'
sortIndex: 80
parent: task-diO4GJe8
---
In `apps/web/**/ingestion-status.tsx`, refactor the `handleIngest` function and related timer logic. Currently there are two competing `setTimeout` calls (5s and 120s) that both mutate `ingesting` state, plus a `setInterval` for polling that leaks on unmount. Refactor into a single `useEffect` that: (1) owns the polling interval, (2) manages the timeout for max duration, (3) cleans up all timers via the useEffect cleanup function on unmount or when ingestion completes. Use `useRef` to hold timer IDs if needed. Ensure no state updates happen after unmount. Remove the competing setTimeout pattern entirely.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:12:13]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
