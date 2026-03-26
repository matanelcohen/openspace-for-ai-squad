---
id: task-jXx0KU3q
title: Implement skill registry & loader runtime
status: blocked
priority: P1
assignee: bender
labels:
  - backend
  - runtime
  - skills
  - API
  - 'parent:task-hgTK5Dbi'
created: '2026-03-25T23:19:39.382Z'
updated: '2026-03-26T01:16:11.880Z'
sortIndex: 154
---
Build the backend skill system: SkillRegistry (discovers and indexes available skills from a /skills directory), SkillLoader (validates manifests, resolves dependencies, instantiates skill instances), and SkillRouter (matches incoming tasks to appropriate skills based on task-type rules). Handle skill isolation so a broken plugin doesn't crash the agent. Expose API endpoints: GET /skills (list), GET /skills/:id (detail), POST /agents/:id/skills (attach skill to agent). Use the manifest schema from the architecture task.

---
**[2026-03-26 01:02:50]** 🚀 Bender started working on this task.

---
**[2026-03-26 01:05:39]** 🚀 Bender started working on this task.

---
**[2026-03-26 01:09:14]** 🚀 Bender started working on this task.

---
**[2026-03-26 01:16:11]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
