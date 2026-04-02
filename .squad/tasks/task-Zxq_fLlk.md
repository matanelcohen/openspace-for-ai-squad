---
id: task-Zxq_fLlk
title: Add onError handlers and isPending guards to mutation call sites
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-t_xX4azF'
created: '2026-04-02T11:22:50.528Z'
updated: '2026-04-02T11:23:08.970Z'
sortIndex: 112
parent: task-t_xX4azF
---
Find all mutation call sites missing onError handlers: (1) workflows/compose/page.tsx handleSave — createWorkflow.mutate() needs onError that resets setSaved and shows a toast. (2) chat-client.tsx clearChat mutation — add onError with toast. (3) workflows/[id]/page.tsx startExecution mutation — add onError with toast. For each site: add an onError callback that shows a descriptive toast notification (use the existing toast system) and resets any optimistic UI state (like setSaved). Also wire up the mutation's isPending state to disable the triggering button to prevent double-submits. Verify no other mutation call sites in the app are missing onError handlers while you're at it.

---
**[2026-04-02 11:23:03]** 🚀 Fry started working on this task.
**[2026-04-02 11:23:03]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:23:08]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
