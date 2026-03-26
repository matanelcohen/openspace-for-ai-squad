---
id: task-Jh7XOEoe
title: Add skill versioning & upgrade management
status: blocked
priority: P1
assignee: bender
labels:
  - skills
  - backend
  - versioning
  - upgrade
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:09.702Z'
updated: '2026-03-26T16:19:21.459Z'
sortIndex: 193
---
Semantic versioning is stored but not actively managed. Implement: (1) version comparison utilities, (2) upgrade detection when a new manifest version is discovered, (3) safe upgrade path—deactivate old → load new → reactivate with migration, (4) rollback support if new version fails activation, (5) UI badge showing 'update available' on skill cards, (6) dependency version constraint checking (e.g., skill A requires skill B >= 2.0.0).

---
**[2026-03-26 15:57:34]** 🚀 Bender started working on this task.

---
**[2026-03-26 16:00:09]** 🚀 Bender started working on this task.

---
**[2026-03-26 16:14:30]** 🚀 Bender started working on this task.

---
**[2026-03-26 16:19:21]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
