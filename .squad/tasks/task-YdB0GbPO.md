---
id: task-YdB0GbPO
title: Add limit/offset pagination to tasks and escalations API routes
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-8-x_Q46m'
created: '2026-04-02T11:08:41.939Z'
updated: '2026-04-02T11:11:32.712Z'
sortIndex: 84
parent: task-8-x_Q46m
---
Update the backend API routes for tasks and escalations to accept `limit` and `offset` (or cursor-based) query parameters, defaulting to 50 records per page. Return a `hasMore` or `nextCursor` field in the response so the frontend can drive infinite scrolling. Reference the existing chat messages endpoint which already implements a 50-message limit pattern. Files likely in apps/api/src/routes/ — look at how chat pagination is done and mirror it for tasks and escalations.

---
**[2026-04-02 11:11:17]** 🚀 Bender started working on this task.
**[2026-04-02 11:11:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:32]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
