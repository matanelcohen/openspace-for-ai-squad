---
id: task-ALCLKni_
title: Add filtering and pagination to API endpoints
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-o8sVmRr2'
created: '2026-04-02T02:14:12.747Z'
updated: '2026-04-02T02:26:57.048Z'
sortIndex: 616
parent: task-o8sVmRr2
---
Update the backend API routes for team-members, skills, and tasks to accept query parameters for filtering (department, status, search) and offset-based pagination (page, limit). Return paginated responses with { data, total, page, limit, hasMore } shape. Files: apps/api/src/routes/team-members.ts and equivalent routes for skills and tasks. Ensure filters are applied at the data-source level (not in-memory). Default limit to 20, max 100.

---
**[2026-04-02 02:14:13]** 🚀 Bender started working on this task.
**[2026-04-02 02:14:13]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:26:57]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
