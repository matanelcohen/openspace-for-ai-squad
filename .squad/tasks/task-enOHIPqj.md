---
id: task-enOHIPqj
title: Add security headers and enforce HTTPS in API client
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-vkD0_s6e'
created: '2026-04-02T00:18:20.148Z'
updated: '2026-04-02T00:26:51.701Z'
sortIndex: 514
parent: task-vkD0_s6e
---
In apps/web/next.config.mjs: add Content-Security-Policy (CSP) and Strict-Transport-Security (HSTS) headers alongside the existing X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers. In apps/web/src/lib/api-client.ts: enforce that non-localhost hosts always use HTTPS by changing the LAN/remote fallback from protocol-matching to explicit 'https://' (keep http:// only for localhost/127.0.0.1). In apps/web/src/components/terminal/terminal.tsx: wrap WebSocket URL construction in a try/catch using the URL constructor to validate the final URL, and ensure wss: is used for non-localhost hosts. Feature branch: feature/task-vkD0_s6e

---
**[2026-04-02 00:18:29]** 🚀 Bender started working on this task.
**[2026-04-02 00:18:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:19:40]** 🚀 Bender started working on this task.
**[2026-04-02 00:19:40]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:19:42]** 🚀 Bender started working on this task.
**[2026-04-02 00:19:42]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:19:47]** 🚀 Bender started working on this task.
**[2026-04-02 00:19:47]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:14]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:14]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:15]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:15]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:15]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:15]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:21]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:21]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:23]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:23]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:22:14]** 🚀 Bender started working on this task.

---
**[2026-04-02 00:22:14]** 🚀 Bender started working on this task.
**[2026-04-02 00:22:14]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:25:31]** 🚀 Bender started working on this task.
**[2026-04-02 00:25:31]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:25:39]** 🚀 Bender started working on this task.
**[2026-04-02 00:25:39]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:00]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:00]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:04]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:04]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:04]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:06]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:06]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:51]** 🛑 Blocked after 5 failed execution attempts.

**Last error:** Agent crashed or timed out
