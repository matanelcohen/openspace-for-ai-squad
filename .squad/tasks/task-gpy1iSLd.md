---
id: task-gpy1iSLd
title: Fix SSR hydration mismatch in SlaCountdown
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-0e-6Ihf3'
created: '2026-04-02T11:22:56.500Z'
updated: '2026-04-02T11:28:52.600Z'
sortIndex: 114
parent: task-0e-6Ihf3
---
In `sla-countdown.tsx`, fix the hydration mismatch by: (1) Add a `mounted` state initialized to `false`, set to `true` in a `useEffect`. (2) Before mounted, render a placeholder ('—') so SSR and initial client render match. (3) After mounted, render the real countdown from `getTimeRemaining(timeoutAt)`. (4) In the `setInterval` effect, add `timeoutAt` to the dependency array so the timer resets when the prop changes. (5) Clear the interval on cleanup. This eliminates the React hydration warning and the visible flicker.

---
**[2026-04-02 11:28:45]** 🚀 Fry started working on this task.
**[2026-04-02 11:28:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:28:52]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
