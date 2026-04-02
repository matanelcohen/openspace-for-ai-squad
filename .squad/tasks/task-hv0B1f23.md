---
id: task-hv0B1f23
title: Add security headers and enforce HTTPS in API client
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-vkD0_s6e'
created: '2026-04-02T00:18:20.278Z'
updated: '2026-04-02T00:37:03.801Z'
sortIndex: 514
parent: task-vkD0_s6e
---
1. In apps/web/next.config.mjs: add Content-Security-Policy header (default-src 'self', script-src 'self' 'unsafe-inline' 'unsafe-eval' for Next.js, style-src 'self' 'unsafe-inline', connect-src 'self' ws: wss:, img-src 'self' data: blob:) and Strict-Transport-Security header (max-age=31536000; includeSubDomains). X-Frame-Options, X-Content-Type-Options, and Referrer-Policy are already present — do not duplicate them.
2. In apps/web/src/lib/api-client.ts: the protocol-matching fallback (`${window.location.protocol}//${window.location.hostname}:3001`) is actually correct — it inherits the page protocol. But add an explicit HTTPS enforcement: if window.location.protocol is 'https:' and the resolved URL starts with 'http://', throw or upgrade to https. Also validate the constructed URL with `new URL()` constructor to prevent malformed URLs.
3. terminal.tsx WebSocket code is already secure (validates protocol, uses URL constructor). No changes needed there.

---
**[2026-04-02 00:18:29]** 🚀 Bender started working on this task.
**[2026-04-02 00:18:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:20:39]** 🚀 Bender started working on this task.
**[2026-04-02 00:20:39]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:22:14]** 🚀 Bender started working on this task.
**[2026-04-02 00:22:14]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:26:52]** 🚀 Bender started working on this task.
**[2026-04-02 00:26:52]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:27:02]** 🚀 Bender started working on this task.
**[2026-04-02 00:27:03]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:27:05]** 🚀 Bender started working on this task.
**[2026-04-02 00:27:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:26]** 🚀 Bender started working on this task.
**[2026-04-02 00:33:26]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:28]** 🚀 Bender started working on this task.
**[2026-04-02 00:33:28]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:31]** 🚀 Bender started working on this task.
**[2026-04-02 00:33:31]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:02]** 🚀 Bender started working on this task.
**[2026-04-02 00:34:02]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:02]** 🚀 Bender started working on this task.
**[2026-04-02 00:34:02]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:35:28]** 🚀 Bender started working on this task.
**[2026-04-02 00:35:28]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:36:58]** 🚀 Bender started working on this task.
**[2026-04-02 00:36:58]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:01]** 🚀 Bender started working on this task.
**[2026-04-02 00:37:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:03]** 🛑 Blocked after 5 execution attempts.

**Last error:** Max attempts reached
