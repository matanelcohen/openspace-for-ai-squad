---
id: task-Ga8sbvsP
title: Fix case-sensitivity bug in actor name matching
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-pPWG9AZp'
created: '2026-04-01T23:32:39.915Z'
updated: '2026-04-02T02:53:51.224Z'
sortIndex: 407
parent: task-pPWG9AZp
---
**[2026-04-02 02:41:34]** 📋 Leela broke this task into 1 sub-tasks:

- **Fix case-insensitive agent ID matching in chat router** → Bender (Backend Dev)
**Feature Branch:** `feature/task-Ga8sbvsP`


**[2026-04-02 02:41:34]** 🔀 Task delegated — waiting for subtask completion.

---
**[2026-04-02 02:51:20]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```

---
**[2026-04-02 02:53:51]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
