---
id: task-RI3KU1jQ
title: Audit & extend MCP server tool bindings
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-CRcTG6PJ'
created: '2026-03-30T12:56:24.186Z'
updated: '2026-03-30T13:33:30.890Z'
sortIndex: 224
parent: task-CRcTG6PJ
---
Review packages/mcp-server/src/server.ts against the 26 API routes in apps/api/src/routes/. Identify any API endpoints that lack corresponding MCP tool definitions (e.g., workflows, escalations, a2a, cron, costs). Add missing tool bindings with proper Zod input schemas and resource subscriptions. Ensure the Fastify SSE plugin in fastify-plugin.ts is properly registered in the API app.

---
**[2026-03-30 12:56:24]** 🚀 Bender started working on this task.
**[2026-03-30 12:56:24]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 13:02:20]** 🚀 Bender started working on this task.
**[2026-03-30 13:02:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 13:08:38]** 🚀 Bender started working on this task.
**[2026-03-30 13:08:38]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 13:17:43]** 🚀 Bender started working on this task.
**[2026-03-30 13:17:43]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 13:23:20]** 🚀 Bender started working on this task.
**[2026-03-30 13:23:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 13:33:30]** 🛑 Permanently blocked after 5 failed attempts.
