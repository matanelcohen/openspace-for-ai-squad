---
id: task-BLtdIXVy
title: Consolidate polling logic in ingestion-status.tsx
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-ayKtVP2N'
created: '2026-04-02T10:29:00.151Z'
updated: '2026-04-02T11:04:16.268Z'
sortIndex: 16
parent: task-ayKtVP2N
---
Open apps/web/src/components/ingestion-status.tsx (or similar path — search for ingestion-status). Identify the three conflicting timer patterns: a setInterval at 3s, a setTimeout at 2min, and another setTimeout at 5s. Refactor to: (1) a single useRef for the polling interval ID, (2) a single useRef for the timeout ID, (3) one consolidated setInterval that polls at a reasonable cadence (e.g. 3s), (4) one setTimeout that stops polling after the max duration (e.g. 2min), (5) a cleanup function in useEffect that clears both the interval and timeout on unmount AND on error, (6) guard against state updates after unmount using an isMounted ref or AbortController. Remove all duplicate timer logic. Ensure no interval/timeout can survive component unmount.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:04:16]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
