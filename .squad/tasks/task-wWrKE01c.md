---
id: task-wWrKE01c
title: Build graceful PTY-unavailable error UI on terminal page
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-eSuFp_zR'
created: '2026-03-31T09:33:59.191Z'
updated: '2026-03-31T09:41:40.285Z'
sortIndex: 303
parent: task-eSuFp_zR
---
In apps/web/src/components/terminal/terminal.tsx, replace the current red ANSI text error with a proper error state UI when PTY is unavailable: 1) On mount, call GET /api/terminal/health to pre-check PTY availability. 2) If PTY is unavailable, show a styled error card (not raw terminal text) with: an icon, the specific error reason from backend, actionable steps to fix (e.g., rebuild native deps, check Docker config), and a 'Retry' button. 3) Handle the 'PTY_UNAVAILABLE' and 'PTY_NOT_INSTALLED' error codes from WebSocket errors to show the same friendly UI instead of dumping red text. 4) Keep the existing reconnection logic for transient network errors — only show the new UI for permanent PTY failures. Current UX just shows red text inside xterm which is hard to read and not actionable.

---
**[2026-03-31 09:33:59]** 🚀 Fry started working on this task.
**[2026-03-31 09:33:59]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:35:45]** 🚀 Fry started working on this task.
**[2026-03-31 09:35:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:38:29]** 🚀 Fry started working on this task.
**[2026-03-31 09:38:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:05]** 🚀 Fry started working on this task.
**[2026-03-31 09:40:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:17]** 🚀 Fry started working on this task.
**[2026-03-31 09:40:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:41:40]** 🛑 Permanently blocked after 5 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
 when PTY is unavailable: 1) On mount, call GET /api/terminal/health to pre-check PTY availability. 2) If PTY is unavailable, show a styled error card (not raw terminal text) with: an icon, the specific error reason from backend, actionable steps to fix (e.g., rebuild native deps, check Docker config), and a 'Retry' button. 3) Handle the 'PTY_UNAVAILABLE' and 'PTY_NOT_INSTALLED' error codes from WebSocket errors to show the same friendly UI instead of dumping red text. 4) Keep the existing reconnection logic for transient network errors — only show the new UI for permanent PTY failures. Current UX just shows red text inside xterm which is hard to read and not actionable.

---
**[2026-03-31 09:33:59]** 🚀 Fry started working on this task.
**[2026-03-31 09:33:59]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:35:45]** 🚀 Fry started working on this task.
**[2026-03-31 09:35:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:38:29]** 🚀 Fry started working on this task.
**[2026-03-31 09:38:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:05]** 🚀 Fry started working on this task.
**[2026-03-31 09:40:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:17]** 🚀 Fry started working on this task.
**[2026-03-31 09:40:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)
