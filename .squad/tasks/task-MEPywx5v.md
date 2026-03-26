---
id: task-MEPywx5v
title: Implement skills API endpoints and registry
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-Too8OrT7'
created: '2026-03-26T18:05:28.234Z'
updated: '2026-03-26T18:21:36.451Z'
sortIndex: 204
---
Ensure all Fastify routes in /api/skills are fully functional: GET (list/filter), POST (register), GET/:id (detail), PUT/:id (update), DELETE/:id (unregister), health checks, and agent-skill attach/detach at /api/agents/:id/skills. Verify SkillRegistryImpl lifecycle (load, validate, activate, deactivate, recover) works correctly. Seed built-in skills from @openspace/skills-core on startup.

---
**[2026-03-26 18:05:28]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:10:54]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:15:33]** 🚀 Bender started working on this task.

---
**[2026-03-26 18:21:36]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
