---
id: task-pjkgYSs7
title: Fix timer and scroll cleanup in frontend pages
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Fr2ZPdsW'
created: '2026-04-02T11:05:38.303Z'
updated: '2026-04-02T11:11:51.294Z'
sortIndex: 65
parent: task-Fr2ZPdsW
---
Fix memory leaks in 4 frontend pages by adding proper cleanup:

1. **workflows/compose/page.tsx (line 22)**: Store the `setTimeout` for `router.push` in a `useRef<NodeJS.Timeout>` and clear it in a `useEffect` cleanup return.
2. **team-members/[id]/page.tsx (line 192)**: Store the `setSaveSuccess` timeout in a `useRef<NodeJS.Timeout>` and clear it on unmount via `useEffect` cleanup.
3. **tasks/[id]/page.tsx (line 59)**: Add a debounced `scrollIntoView` using `useRef` timer — when `events.length` changes, clear any pending scroll timeout before setting a new one (~150ms debounce). Clean up on unmount.
4. **cron/page.tsx (line 141)**: Fix `runningId` state race by storing the timer in a `useRef`, clearing previous timer before setting a new one, and cleaning up on unmount.

Pattern for each fix: `const timerRef = useRef<NodeJS.Timeout>()` → set with `timerRef.current = setTimeout(...)` → clear previous with `clearTimeout(timerRef.current)` → cleanup in `useEffect` return.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:51]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
