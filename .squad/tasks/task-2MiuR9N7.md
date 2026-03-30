---
id: task-2MiuR9N7
title: Fix backend terminal WebSocket reliability
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-sKDRWFwZ'
created: '2026-03-30T11:48:55.431Z'
updated: '2026-03-30T11:56:40.122Z'
sortIndex: 218
parent: task-sKDRWFwZ
---
Investigate and harden the terminal WebSocket server at /apps/api/src/routes/terminal.ts. Key areas:
1. Add heartbeat/ping-pong to detect dead connections (the WebSocket may silently disconnect without server knowing)
2. Add server-side logging when PTY spawn fails, WebSocket closes unexpectedly, or client disconnects
3. Ensure the PTY process is always cleaned up on disconnect (check socket.on('close') handler at line 99-106)
4. Verify the SHELL env var and fallback to bash works correctly
5. Test that the /api/terminal/ws endpoint is properly registered and reachable (check app.ts line 29)

The 'reconnecting' loop suggests the server may be closing the connection immediately after open, or PTY spawn is failing silently.

---
**[2026-03-30 11:48:55]** 🚀 Bender started working on this task.
**[2026-03-30 11:48:55]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:49:53]** 🚀 Bender started working on this task.
**[2026-03-30 11:49:53]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:51:38]** 🚀 Bender started working on this task.
**[2026-03-30 11:51:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:54:38]** 🚀 Bender started working on this task.
**[2026-03-30 11:54:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:56:40]** 🛑 Permanently blocked after 4 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
