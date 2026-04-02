---
id: task-eukjk8Hb
title: Fix case-insensitive agent ID matching in chat router
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-Ga8sbvsP'
created: '2026-04-02T02:41:34.460Z'
updated: '2026-04-02T03:05:02.669Z'
sortIndex: 653
parent: task-Ga8sbvsP
---
In `apps/api/src/services/chat/index.ts` line 1131, the `routeToAgents` method compares `lower` (already lowercased content) with `a.id` without lowercasing it. Fix: change `lower.includes(a.id)` to `lower.includes(a.id.toLowerCase())`. Run existing tests (`vitest`) to verify no regressions.

---
**[2026-04-02 02:41:34]** 🚀 Bender started working on this task.
**[2026-04-02 02:41:34]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:05:02]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
