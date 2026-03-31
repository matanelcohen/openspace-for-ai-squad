---
id: task-PsZmh5lr
title: Fix 2 failing terminal tests and add edge-case coverage
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-PRYrQNNq'
created: '2026-03-31T07:57:01.944Z'
updated: '2026-03-31T07:59:21.304Z'
sortIndex: 233
parent: task-PRYrQNNq
---
Fix the 2 failing tests in apps/web/src/components/terminal/__tests__/terminal-reconnection.test.tsx at lines 419 and 474 — they expect 'Connection failed' but the component renders 'Unable to reach the backend — is the API server running?'. Update assertions to match the actual component output. Then add edge-case tests: (1) retry button clicked during reconnecting state, (2) rapid WebSocket disconnect/reconnect cycles, (3) cleanup verification on unmount (no dangling timers).

---
**[2026-03-31 07:58:28]** 🚀 Zoidberg started working on this task.
**[2026-03-31 07:58:28]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:58:46]** 🚀 Zoidberg started working on this task.
**[2026-03-31 07:58:46]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:58:52]** 🚀 Zoidberg started working on this task.
**[2026-03-31 07:58:52]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 07:59:21]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
