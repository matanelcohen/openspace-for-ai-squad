---
id: task-AOV_RZhA
title: Replace module-level counters with useId in escalation components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-0FMxfjS1'
created: '2026-04-02T02:54:15.798Z'
updated: '2026-04-02T03:09:54.536Z'
sortIndex: 654
parent: task-0FMxfjS1
---
Two files need refactoring:

1. `apps/web/src/components/escalations/threshold-config-panel.tsx` (line 22): Replace `let keyCounter = 0` and `nextKey()` function with React `useId()` hook. The component uses `_key: string` on `ThresholdRow` interface — generate keys using the useId base combined with the row index (e.g. `${id}-threshold-${index}`).

2. `apps/web/src/components/escalations/escalation-chain-editor.tsx` (line 19): Replace `let chainKeyCounter = 0` and `nextChainKey()` function with React `useId()` hook. Use `${id}-chain-${index}` pattern for chain keys.

For both files:
- Add `useId` to the React import
- Remove the module-level `let` counter and the `next*Key()` helper
- Call `useId()` inside the component and use the returned base id to derive stable keys
- Ensure the `_key` field on rows is populated using the useId-based key in all places where `nextKey()` / `nextChainKey()` was called (initial state, add-row handlers, etc.)
- Keep the 'use client' directive

---
**[2026-04-02 02:54:16]** 🚀 Fry started working on this task.
**[2026-04-02 02:54:16]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 03:09:54]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
