---
id: task-KMApkQlm
title: Fix useEffect dependency array in voice-speaker.tsx
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-1b06P6JT'
created: '2026-04-02T11:07:54.474Z'
updated: '2026-04-02T11:12:00.920Z'
sortIndex: 82
parent: task-1b06P6JT
---
In `apps/web/src/components/voice-speaker.tsx`, locate the `useEffect` that calls `onQueueEmpty`. It currently has no dependency array, causing it to run on every render and trigger infinite callbacks. Add `[queue.length, onQueueEmpty]` as the dependency array so it only fires when the queue is actually drained. Ensure `onQueueEmpty` is stable (wrapped in `useCallback` by the parent) or guard against stale closures.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:12:00]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
