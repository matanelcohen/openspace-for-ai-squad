---
id: task-_rb31LmZ
title: Add PTY-specific error codes and detection on backend
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-eSuFp_zR'
created: '2026-03-31T09:33:58.937Z'
updated: '2026-03-31T09:40:17.513Z'
sortIndex: 302
parent: task-eSuFp_zR
---
In apps/api/src/routes/terminal.ts, improve the PTY spawn failure handling: 1) Detect specific failure modes (node-pty not installed/built, platform doesn't support PTY, permission denied) and send distinct error codes like 'PTY_UNAVAILABLE', 'PTY_SPAWN_FAILED', 'PTY_NOT_INSTALLED'. 2) Include a human-readable 'reason' field with actionable guidance (e.g., 'Run pnpm rebuild to compile native modules'). 3) Add a health-check GET endpoint '/api/terminal/health' that pre-checks PTY availability so the frontend can detect the issue before attempting a WebSocket connection. Current spawn error just sends generic 'Terminal unavailable: <message>'.

---
**[2026-03-31 09:33:58]** 🚀 Bender started working on this task.
**[2026-03-31 09:33:58]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:35:45]** 🚀 Bender started working on this task.
**[2026-03-31 09:35:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:38:29]** 🚀 Bender started working on this task.
**[2026-03-31 09:38:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:05]** 🚀 Bender started working on this task.
**[2026-03-31 09:40:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:17]** 🛑 Permanently blocked after 4 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
uilt, platform doesn't support PTY, permission denied) and send distinct error codes like 'PTY_UNAVAILABLE', 'PTY_SPAWN_FAILED', 'PTY_NOT_INSTALLED'. 2) Include a human-readable 'reason' field with actionable guidance (e.g., 'Run pnpm rebuild to compile native modules'). 3) Add a health-check GET endpoint '/api/terminal/health' that pre-checks PTY availability so the frontend can detect the issue before attempting a WebSocket connection. Current spawn error just sends generic 'Terminal unavailable: <message>'.

---
**[2026-03-31 09:33:58]** 🚀 Bender started working on this task.
**[2026-03-31 09:33:58]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:35:45]** 🚀 Bender started working on this task.
**[2026-03-31 09:35:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:38:29]** 🚀 Bender started working on this task.
**[2026-03-31 09:38:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:05]** 🚀 Bender started working on this task.
**[2026-03-31 09:40:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)
