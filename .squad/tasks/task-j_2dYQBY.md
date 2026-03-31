---
id: task-j_2dYQBY
title: Verify terminal WebSocket backend resilience
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-PRYrQNNq'
created: '2026-03-31T07:57:01.897Z'
updated: '2026-03-31T07:59:21.634Z'
sortIndex: 232
parent: task-PRYrQNNq
---
Review apps/api/src/routes/terminal.ts to ensure the PTY error handling (lines 56-62) and force-kill timer (lines 128-138) are robust. Test with an invalid SHELL path to confirm graceful failure. Verify WebSocket close codes are standard (line 83 uses 1000). Ensure isValidMessage() (lines 32-42) handles edge-case messages without silent failures.

---
**[2026-03-31 07:58:15]** 🚀 Bender started working on this task.
**[2026-03-31 07:58:15]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:58:20]** 🚀 Bender started working on this task.
**[2026-03-31 07:58:20]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:58:33]** 🚀 Bender started working on this task.
**[2026-03-31 07:58:33]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:58:52]** 🚀 Bender started working on this task.
**[2026-03-31 07:58:52]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:59:21]** 🛑 Permanently blocked after 4 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
