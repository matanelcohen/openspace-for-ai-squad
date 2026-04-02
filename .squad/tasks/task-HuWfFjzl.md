---
id: task-HuWfFjzl
title: Refactor keyCounter to useRef in both escalation components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-9uIcxK2i'
created: '2026-04-02T03:44:27.346Z'
updated: '2026-04-02T03:47:01.837Z'
sortIndex: 675
parent: task-9uIcxK2i
---
In `apps/web/src/components/escalations/threshold-config-panel.tsx`, move the module-level `let keyCounter = 0` and its `nextKey()` helper into the component using `useRef`. Replace all call sites (`useState` initializer, `useEffect`, `addRow`, `handleReset`) to use the ref-based counter. Do the same in `apps/web/src/components/escalations/escalation-chain-editor.tsx` for `let chainKeyCounter = 0` and `nextChainKey()`. The ref pattern should be: `const keyCounterRef = useRef(0)` and a local `nextKey` that does `return \`threshold-${++keyCounterRef.current}\``. Remove the module-level variables and free functions entirely. Make sure `useRef` is imported from React.

---
**[2026-04-02 03:46:55]** 🚀 Fry started working on this task.
**[2026-04-02 03:46:55]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 03:47:01]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
