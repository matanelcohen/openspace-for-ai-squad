---
id: task-N9icdZz_
title: Validate skills API error handling and edge cases
status: blocked
priority: P2
assignee: bender
labels:
  - backend
  - api
  - skills
  - reliability
  - 'parent:task-Too8OrT7'
created: '2026-03-26T18:07:18.075Z'
updated: '2026-03-26T18:41:43.256Z'
sortIndex: 210
---
Review /apps/api/src/routes/skills.ts and skill-registry service for edge cases: duplicate skill registration, invalid manifests, circular dependencies, concurrent activation/deactivation, health check failures, and recovery flow. Add missing validation and ensure proper HTTP status codes and error messages.

---
**[2026-03-26 18:34:08]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:37:20]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:39:38]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:41:43]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
