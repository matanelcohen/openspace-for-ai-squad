---
id: task-mZNanKNY
title: Add skill error recovery & auto-retry mechanism
status: blocked
priority: P1
assignee: bender
labels:
  - skills
  - backend
  - reliability
  - error-handling
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:09.676Z'
updated: '2026-03-26T15:57:34.272Z'
sortIndex: 192
---
Currently, failed lifecycle hooks transition a skill to 'error' phase with no auto-recovery. Implement: (1) configurable retry policy per skill (maxRetries, backoff strategy in manifest), (2) automatic re-activation attempt after transient failures, (3) circuit breaker pattern—after N consecutive failures, disable skill and notify, (4) a 'recover' API endpoint to manually retry failed skills, (5) health check heartbeat for active skills. Update skill-isolation.ts and the registry accordingly.

---
**[2026-03-26 15:45:01]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:48:47]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:52:11]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:57:34]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
