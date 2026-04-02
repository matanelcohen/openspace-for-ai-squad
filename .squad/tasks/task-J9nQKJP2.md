---
id: task-J9nQKJP2
title: Replace module-level counters with useId+useRef in React components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-0FMxfjS1'
created: '2026-04-02T02:27:29.401Z'
updated: '2026-04-02T02:57:30.216Z'
sortIndex: 651
parent: task-0FMxfjS1
---
Fix SSR hydration mismatch in two files:

1. `apps/web/src/components/escalations/threshold-config-panel.tsx` (line 22-25): Replace `let keyCounter = 0` and `nextKey()` with an SSR-safe approach using `useId()` for a stable prefix and `useRef` for the incrementing counter inside the component.
2. `apps/web/src/components/escalations/escalation-chain-editor.tsx` (line 19-22): Replace `let chainKeyCounter = 0` and `nextChainKey()` with the same pattern.

The problem: Module-level `let counter = 0` persists across requests on the server and produces different sequences server vs client, causing React hydration mismatches.

The fix pattern for each file:
- Remove the module-level `let counter` and the `nextKey()` / `nextChainKey()` function
- Inside the component, add `const id = useId()` and `const counterRef = useRef(0)` 
- Create a local `nextKey` function: `const nextKey = useCallback(() => \`${id}-${++counterRef.current}\`, [id])`
- Import `useId` and `useRef` from React (add to existing import)
- Pass the `nextKey` function to wherever the old module-level function was called

Make sure the `_key` property on `ThresholdRow` items still gets unique string values. The keys are used as React list keys — they must be unique within the list but don't need to be globally unique.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:57:30]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
