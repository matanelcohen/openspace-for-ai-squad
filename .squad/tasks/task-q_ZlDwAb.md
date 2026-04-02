---
id: task-q_ZlDwAb
title: Fix setTimeout cleanup in workflows and team-members pages
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-nqY5GIFV'
created: '2026-04-02T10:30:55.540Z'
updated: '2026-04-02T11:04:20.766Z'
sortIndex: 23
parent: task-nqY5GIFV
---
Fix setTimeout memory leaks in two files:

1. `apps/web/app/(dashboard)/workflows/compose/page.tsx` (lines 22-24): Store the timeout ID in a `useRef`, and return a cleanup function from the `useEffect` that calls `clearTimeout(ref.current)`.

2. `apps/web/app/(dashboard)/team-members/[id]/page.tsx` (line 192): Same pattern — store timeout ID in a ref, clear it in the useEffect cleanup return.

Ensure no setState-on-unmount warnings occur when navigating away before timers fire. Use `useRef<ReturnType<typeof setTimeout> | null>(null)` for the ref type.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **lightweight** — Single agent with tools (maxAgents: 1)

---
**[2026-04-02 11:04:20]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
