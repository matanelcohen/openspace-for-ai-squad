---
id: task-ulhkaEkm
title: Refactor keyCounter to useRef
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-u6cd3_fe'
created: '2026-04-02T03:56:34.054Z'
updated: '2026-04-02T03:57:35.794Z'
sortIndex: 680
parent: task-u6cd3_fe
---
In `apps/web/src/components/escalations/threshold-config-panel.tsx`:
1. Add `useRef` to the React import (line 5)
2. Remove the module-level `let keyCounter = 0;` (line 22) and the `nextKey()` function (lines 23-25)
3. Inside `ThresholdConfigPanel`, add `const keyCounterRef = useRef(0);` and a local `nextKey` function: `const nextKey = () => 'threshold-${++keyCounterRef.current}';`
4. Ensure all existing call sites (`thresholds.map(...)` in useState initializer and useEffect) still work with the component-scoped `nextKey`.

---
**[2026-04-02 03:57:28]** 🚀 Fry started working on this task.
**[2026-04-02 03:57:28]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 03:57:35]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
