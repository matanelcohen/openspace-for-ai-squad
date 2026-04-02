---
id: task-5Nm7QuIb
title: Add res.ok checks and tighten zod validation in MCP server handlers
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-IrA_Pt-f'
created: '2026-04-02T11:07:33.591Z'
updated: '2026-04-02T11:11:28.297Z'
sortIndex: 80
parent: task-IrA_Pt-f
---
In packages/mcp-server/src/server.ts, fix the 6 tool handlers (list_agents:44, get_agent:55, list_tasks:75, get_task:86, list_decisions:240, get_squad_status:346) that call res.json() without checking res.ok first. Follow the existing pattern at lines 287-291 to throw a descriptive error on 4xx/5xx responses. Also change update_task_status (line 148) to use z.enum() with valid status values instead of z.string(). Look at the Task type or existing enums in the codebase to determine the correct set of allowed status values.

---
**[2026-04-02 11:11:17]** 🚀 Bender started working on this task.
**[2026-04-02 11:11:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:28]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
