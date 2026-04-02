---
id: task-Adzaf16q
title: Stabilize startListening with useCallback and fix useEffect deps
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-i9lopsjI'
created: '2026-04-02T10:29:26.948Z'
updated: '2026-04-02T11:04:40.899Z'
sortIndex: 18
parent: task-i9lopsjI
---
In the upstream hook that provides `startListening` (likely a custom voice/listening hook), wrap the `startListening` function in `useCallback` with correct dependencies so its reference is stable. Then in `voice-room.tsx`, add `startListening` to the `useEffect` dependency array and remove the `eslint-disable` / `eslint-ignore` comment for `react-hooks/exhaustive-deps`. Ensure no other consumers of the hook break from this change.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:04:40]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
