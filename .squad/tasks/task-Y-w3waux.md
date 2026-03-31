---
id: task-Y-w3waux
title: MCP Server Core Setup
status: done
priority: P0
assignee: bender
labels:
  - backend
  - infrastructure
  - mcp
  - 'parent:task-CRcTG6PJ'
created: '2026-03-25T23:20:11.256Z'
updated: '2026-03-31T21:51:04.892Z'
sortIndex: 110
---
Create a new `packages/mcp-server` package (or add to `apps/api`) that initializes an MCP server using `@modelcontextprotocol/sdk`. Support both stdio and SSE transports so external clients (Claude Desktop, Cursor, VS Code Copilot) can connect. Register it as a Fastify plugin at `/mcp` for SSE, and expose a standalone `bin/mcp-server.ts` entry point for stdio transport. Wire up the server lifecycle (init, shutdown) and configure Turborepo build pipeline. Add `@modelcontextprotocol/sdk` dependency.

---
**[2026-03-26 05:44:18]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 05:37:15]** 🧠 Thinking: Let me understand the task: I need to create an MCP server package that:

1. Creates `packages/mcp-server` package
2. Uses `@modelcontextprotocol/sdk`
**[2026-03-26 05:37:15]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:15]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:19]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:23]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:36]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:42]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:42]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:42]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:42]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:45]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:45]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:48]** 🔧 Using tool: `unknown`
**[2026-03-26 05:37:50]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:22]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:35]** 🧠 Thinking: Great, I now have a comprehensive understanding of the codebase. Interestingly, it looks like `packages/mcp-server` already exists with a `package.jso
**[2026-03-26 05:38:35]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:35]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:39]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:38:44]** 🔧 Using tool: `unknown`
**[2026-03-26 05:39:20]** 🧠 Thinking: Interesting! The `packages/mcp-server` package already exists with quite a bit of implementation. Let me understand what's there and what's missing ac
**[2026-03-26 05:39:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:41:43]** 🧠 Thinking: Now I have a clear picture. Here's what I need to do:

1. **Create `src/fastify-plugin.ts`** — A proper Fastify plugin using `fastify-plugin` that:
  
**[2026-03-26 05:41:43]** 🔧 Using tool: `unknown`
**[2026-03-26 05:41:43]** 🔧 Using tool: `unknown`
**[2026-03-26 05:41:44]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/mcp-server/src/fastify-plugin.ts
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:07]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:11]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:27]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:34]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:52]** 🧠 Thinking: The first error is mine: `Cannot find module '@openspace/mcp-server'`. The rest are pre-existing errors in `escalations.ts`.

The mcp-server module re
**[2026-03-26 05:42:52]** 🔧 Using tool: `unknown`
**[2026-03-26 05:42:57]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:10]** 🧠 Thinking: The build seemed to succeed but there's no dist directory. Let me check the tsconfig more carefully. The root tsconfig has `"noEmit": true`, and the m
**[2026-03-26 05:43:10]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:14]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:20]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:25]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:34]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:41]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:46]** 🔧 Using tool: `unknown`
**[2026-03-26 05:43:53]** 🔧 Using tool: `unknown`
**[2026-03-26 05:44:02]** 🔧 Using tool: `unknown`

**[2026-03-26 05:44:18]** ✅ Bender completed this task.

**Result:**
Committed. Lint-staged (eslint + prettier) passed on all files. Here's what was done:

**Summary:**

| File | Change |
|------|--------|
| `packages/mcp-server/src/fastify-plugin.ts` | **New** — Fastify plugin exposing MCP over SSE (`GET /mcp/sse`, `POST /mcp/messages`) with session tracking and graceful shutdown |
| `packages/mcp-server/src/index.ts` | Export `mcpPlugin` alongside `createServer` |
| `packages/mcp-server/src/cli.ts` | Added SIGTERM/SIGINT handlers for graceful shutdown of stdio transport |
| `packages/mcp-server/package.json` | Added `fastify` + `fastify-plugin` dependencies |
| `packages/mcp-server/tsconfig.json` | Fixed `noEmit: false`, added `declaration` + `sourceMap` so `tsc` actually emits `dist/` |
| `apps/api/src/app.ts` | Registered `mcpPlugin` at `{ prefix: '/mcp' }` |
| `apps/api/package.json` | Added `@openspace/mcp-server: workspace:*` dependency |

**Transports:**
- **SSE** → `GET /mcp/sse` + `POST /mcp/messages` (via Fastify plugin in API)
- **stdio** → `npx openspace-mcp` or `node dist/cli.js` (standalone for Claude Desktop, Cursor, VS Code Copilot)
- **Standalone SSE** → `node dist/sse.js` (Express, kept as alternative)
