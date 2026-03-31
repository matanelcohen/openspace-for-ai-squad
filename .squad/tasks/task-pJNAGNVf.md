---
id: task-pJNAGNVf
title: Expose Squad Resources & Prompts via MCP
status: done
priority: P1
assignee: bender
labels:
  - backend
  - mcp
  - api
  - 'parent:task-CRcTG6PJ'
created: '2026-03-25T23:20:11.283Z'
updated: '2026-03-31T21:51:04.894Z'
sortIndex: 112
---
Register MCP resources that let clients read squad state:
- `squad://agents` — list of agents with roles, expertise, status
- `squad://agents/{id}` — single agent detail
- `squad://tasks` — current task board (filterable by status/assignee)
- `squad://tasks/{id}` — single task with sub-tasks
- `squad://activity` — recent activity feed
- `squad://decisions` — decision log
Also register 1-2 MCP prompts (e.g., `squad-status-summary`, `plan-feature`) that provide useful prompt templates. Implement resource subscriptions for tasks and activity so clients get real-time updates via the existing WebSocket bridge pattern.

---
**[2026-03-26 05:56:37]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 05:50:08]** 🧠 Thinking: Let me understand the task: I need to expose Squad resources and prompts via MCP (Model Context Protocol). Let me first explore the codebase to unders
**[2026-03-26 05:50:08]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:08]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:08]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:08]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:44]** 🧠 Thinking: Now I have a good picture. The MCP server already has:
- Tools: list_agents, get_agent, list_tasks, get_task, create_task, update_task, etc.
- Resourc
**[2026-03-26 05:50:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:54]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:54]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:54]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:50:59]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:08]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:41]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:45]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:50]** 🔧 Using tool: `unknown`
**[2026-03-26 05:51:55]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:00]** 🧠 Thinking: Let me check if the underlying Server class has resource subscription notification methods.
**[2026-03-26 05:52:00]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:38]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:38]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 05:52:55]** ℹ️ /Users/matancohen/.copilot/session-state/2c529e34-c31f-48de-a821-013e37f878f7/plan.md
**[2026-03-26 05:53:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:12]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:21]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:31]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:37]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:42]** 🔧 Using tool: `unknown`
**[2026-03-26 05:53:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:54:29]** 🔧 Using tool: `unknown`
**[2026-03-26 05:54:37]** 🔧 Using tool: `unknown`
**[2026-03-26 05:54:49]** 🔧 Using tool: `unknown`
**[2026-03-26 05:54:54]** 🔧 Using tool: `unknown`
**[2026-03-26 05:54:58]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:55:56]** 🔧 Using tool: `unknown`
**[2026-03-26 05:56:03]** 🔧 Using tool: `unknown`
**[2026-03-26 05:56:10]** 🔧 Using tool: `unknown`
**[2026-03-26 05:56:10]** 🔧 Using tool: `unknown`
**[2026-03-26 05:56:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:56:26]** 🔧 Using tool: `unknown`

**[2026-03-26 05:56:37]** ✅ Bender completed this task.

**Result:**
Done. Here's what I did:

**`packages/mcp-server/src/server.ts`** — Added:
- **6 `squad://` resources**: `agents`, `tasks`, `activity`, `decisions` (static) + `agents/{id}`, `tasks/{id}` (templates with list enumeration & autocompletion)
- **2 MCP prompts**: `squad-status-summary` (zero-arg, injects live squad state + recent activity) and `plan-feature` (takes `feature` + optional `scope`, injects agents & current task board)
- **Resource subscription support**: Enabled `subscribe` capability and exposed `notifyResourceUpdated()` helper on the `SquadMcpServer` type for downstream consumers (e.g., the WebSocket bridge) to trigger `notifications/resources/updated`
- Kept existing `openspace://` resources for backward compatibility

**`packages/mcp-server/src/index.ts`** — Exported `SquadMcpServer` type.

**`packages/mcp-server/src/__tests__/server.test.ts`** — Added 16 new tests (33 total, all passing) covering resource listing, template reads, prompt registration/execution, and subscription notifications.
