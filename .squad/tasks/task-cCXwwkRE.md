---
id: task-cCXwwkRE
title: Add AbortController and effect cleanup to async hooks/components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Ju5sMdl8'
created: '2026-04-02T11:15:10.259Z'
updated: '2026-04-02T11:17:26.246Z'
sortIndex: 103
parent: task-Ju5sMdl8
---
Fix two unguarded async effects:

1. **use-voice-session.ts**: Wrap the POST to `/api/voice/speak` with an AbortController. Return a cleanup function from the useEffect that calls `controller.abort()`. Guard the state-setting callbacks so they no-op if the signal was aborted.

2. **workflows/compose/page.tsx**: Remove the inline `setTimeout(router.push, 1000)` from the onSuccess handler. Instead, set a `saved` state flag in onSuccess, and add a separate `useEffect` that watches `saved` — when true, start the timeout and return a cleanup function that calls `clearTimeout`. This ensures navigating away before the 1s delay cancels the stale push.

Verify no 'state update on unmounted component' warnings appear in the console after both fixes.

---
**[2026-04-02 11:17:13]** 🚀 Fry started working on this task.
**[2026-04-02 11:17:13]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:17:26]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
