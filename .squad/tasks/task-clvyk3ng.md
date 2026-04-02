---
id: task-clvyk3ng
title: Wrap async setInterval callbacks with .catch()
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-XmgGXy1j'
created: '2026-04-02T11:22:26.030Z'
updated: '2026-04-02T11:22:36.609Z'
sortIndex: 110
parent: task-XmgGXy1j
---
In agent-worker/index.ts (lines ~230, ~248, ~1577) and innovation/index.ts (line ~31), async functions like scan() and cleanup() are fired inside setInterval without .catch(). Wrap each callback: setInterval(() => { fn().catch(err => logger.error(err)); }, ms). Fix all ~4 call sites across both services. Ensure the error logging uses the existing logger in each service rather than console.error.

---
**[2026-04-02 11:22:26]** 🚀 Bender started working on this task.
**[2026-04-02 11:22:26]** 🎚️ Response tier: **lightweight** — Single agent with tools (maxAgents: 1)

---
**[2026-04-02 11:22:36]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
