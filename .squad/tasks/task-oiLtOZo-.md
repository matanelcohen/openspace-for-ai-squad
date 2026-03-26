---
id: task-oiLtOZo-
title: 'Add missing skill API endpoints (deactivate, delete, update, CRUD)'
status: blocked
priority: P0
assignee: bender
labels:
  - skills
  - backend
  - API
  - CRUD
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:09.647Z'
updated: '2026-03-26T15:45:01.617Z'
sortIndex: 191
---
Currently the API only has 3 endpoints: GET /api/skills, GET /api/skills/:id, POST /api/agents/:id/skills. Missing: DELETE /api/agents/:id/skills/:skillId (deactivate), PUT /api/skills/:id (update manifest), POST /api/skills (register new skill), DELETE /api/skills/:id (unregister). Also add GET /api/skills/:id/agents to see which agents use a skill. The registry already supports these operations internally—just need route wiring and validation.

---
**[2026-03-26 15:31:59]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:39:35]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:42:10]** 🚀 Bender started working on this task.

---
**[2026-03-26 15:45:01]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
