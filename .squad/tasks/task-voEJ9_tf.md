---
id: task-voEJ9_tf
title: Expose Squad Tools via MCP
status: done
priority: P0
assignee: bender
labels:
  - backend
  - mcp
  - api
  - 'parent:task-CRcTG6PJ'
created: '2026-03-25T23:20:11.269Z'
updated: '2026-03-26T05:49:59.436Z'
sortIndex: 167
---
Register MCP tools that map to existing API service methods. Tools to expose:
- `create_task` / `update_task` / `delete_task` / `list_tasks` / `get_task` — full task CRUD via SquadWriter/SquadParser
- `send_chat_message` / `get_chat_history` — chat via ChatService
- `get_agent_status` / `list_agents` — agent info via SquadParser + AgentWorkerService
- `get_activity_feed` — recent activity events
- `approve_task` / `reject_task` — task approval workflow
Each tool needs a JSON Schema for input params and should reuse existing service layer (not duplicate logic). Use TypeBox schemas from shared package where possible.

---
**[2026-03-26 05:49:59]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 05:44:28]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the existing services, MCP setup, and shared schemas.
**[2026-03-26 05:44:28]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:28]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:28]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:28]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:35]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:35]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:35]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:47]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:55]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:58]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:01]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:04]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:06]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:09]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:15]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:15]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:17]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:18]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:21]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:21]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:21]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:21]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:26]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:29]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:29]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:29]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:29]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:30]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:34]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:34]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:34]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:37]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:37]** 🔧 Using tool: `unknown`
**[2026-03-26 05:45:40]** 🔧 Using tool: `unknown`
**[2026-03-26 05:46:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:46:51]** 🔧 Using tool: `unknown`
**[2026-03-26 05:46:57]** 🔧 Using tool: `unknown`
**[2026-03-26 05:46:57]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:03]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:16]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me now look at the actual MCP server code to understand the current tool implementations
**[2026-03-26 05:47:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:16]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:22]** 🧠 Thinking: Now let me also check the chat and activity routes to understand the API endpoints:
**[2026-03-26 05:47:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:27]** 🧠 Thinking: Now I have a complete understanding. Let me also check the existing tests for the MCP server:
**[2026-03-26 05:47:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:41]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:41]** 🔧 Using tool: `unknown`
**[2026-03-26 05:47:41]** ℹ️ /Users/matancohen/.copilot/session-state/94084fed-d463-4790-a0fc-be9be5667db9/plan.md
**[2026-03-26 05:48:02]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:15]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:19]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:24]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:32]** 🔧 Using tool: `unknown`
**[2026-03-26 05:48:37]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:13]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:14]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/mcp-server/src/__tests__/server.test.ts
**[2026-03-26 05:49:19]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:33]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:49:50]** 🔧 Using tool: `unknown`

**[2026-03-26 05:49:59]** ✅ Bender completed this task.

**Result:**
Done. Here's the summary:

**Added 7 new MCP tools** to `packages/mcp-server/src/server.ts` (16 total):

| Tool | Method | API Endpoint |
|------|--------|-------------|
| `update_task` | PUT | `/api/tasks/:id` |
| `delete_task` | DELETE | `/api/tasks/:id` |
| `approve_task` | PATCH | `/api/tasks/:id/approve` |
| `reject_task` | PATCH | `/api/tasks/:id/reject` |
| `get_chat_history` | GET | `/api/chat/messages` |
| `get_agent_status` | GET | `/api/agents/status` |
| `get_activity_feed` | GET | `/api/activity` |

All tools reuse existing API endpoints via fetch, use Zod schemas with typed enums for `status`/`priority`, and return `isError: true` on non-OK responses. Added 17 tests covering registration, schemas, and execution. Typecheck, build, lint, and tests all pass.
