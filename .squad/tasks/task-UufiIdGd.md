---
id: task-UufiIdGd
title: Refactor chainKeyCounter to useRef and fix key stability
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-SQ-N7gVL'
created: '2026-04-02T03:50:47.745Z'
updated: '2026-04-02T03:52:27.902Z'
sortIndex: 677
parent: task-SQ-N7gVL
---
In `apps/web/src/components/escalations/escalation-chain-editor.tsx`, the `chainKeyCounter` is a module-level mutable variable (line 19: `let chainKeyCounter = 0`) shared across all component instances. This causes: (1) unbounded counter growth across mounts/unmounts, (2) test pollution between test cases, (3) React key instability on remount causing unnecessary DOM reconciliation.

**Fix:**
1. Remove the module-level `let chainKeyCounter = 0` and `function nextChainKey()` (lines 19-22).
2. Inside the `EscalationChainEditor` component, add a `useRef`-based counter:
   ```typescript
   const chainKeyRef = useRef(0);
   const nextChainKey = useCallback(() => `chain-${++chainKeyRef.current}`, []);
   ```
3. Update all call sites (lines ~53, ~59, ~79, ~169) to use the instance-scoped `nextChainKey`.
4. Verify the existing 19 tests still pass after the refactor (`pnpm --filter @openspace/web exec vitest run src/components/escalations/__tests__/escalation-chain-editor.test.tsx`).

---
**[2026-04-02 03:52:10]** 🚀 Fry started working on this task.
**[2026-04-02 03:52:10]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 03:52:27]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
