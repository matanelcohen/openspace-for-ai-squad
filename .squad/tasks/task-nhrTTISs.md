---
id: task-nhrTTISs
title: Test PTY-unavailable error flows end-to-end
status: blocked
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-eSuFp_zR'
created: '2026-03-31T09:33:59.968Z'
updated: '2026-03-31T09:40:17.542Z'
sortIndex: 304
parent: task-eSuFp_zR
---
Add tests covering the new PTY error UX: 1) Backend tests in apps/api/src/routes/__tests__/: test the /api/terminal/health endpoint returns correct status when PTY is available vs unavailable, test that spawn failures send the new structured error codes (PTY_UNAVAILABLE, PTY_NOT_INSTALLED, PTY_SPAWN_FAILED). 2) Frontend tests in apps/web/src/components/terminal/__tests__/: test that the health check pre-flight works and shows the error card UI, test that PTY_UNAVAILABLE WebSocket error shows the friendly error state (not red ANSI text), test that transient errors still trigger normal reconnection (no regression), test the retry button on the error card re-checks health and attempts reconnection.

---
**[2026-03-31 09:33:59]** 🚀 Zoidberg started working on this task.
**[2026-03-31 09:33:59]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:35:45]** 🚀 Zoidberg started working on this task.
**[2026-03-31 09:35:45]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:38:29]** 🚀 Zoidberg started working on this task.
**[2026-03-31 09:38:29]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:05]** 🚀 Zoidberg started working on this task.
**[2026-03-31 09:40:05]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 09:40:17]** 🛑 Permanently blocked after 4 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
