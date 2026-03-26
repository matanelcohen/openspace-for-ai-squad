---
id: task-ZCKGvBMC
title: Implement skill configuration UI & per-agent persistence
status: blocked
priority: P0
assignee: fry
labels:
  - skills
  - frontend
  - UX
  - config
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:09.587Z'
updated: '2026-03-26T15:45:01.602Z'
sortIndex: 190
---
The skill config schema is defined in types but the UI for configuring skill parameters per-agent is not implemented. Build a SkillConfigEditor component that renders config fields from the manifest schema, and persist per-agent skill configurations in the database (currently only a simple string[] of skill IDs is stored). Add a `skill_configs` table or expand the team_members.skills column to store {skillId, config, priority} objects.

---
**[2026-03-26 15:36:04]** 🚀 Fry started working on this task.

---
**[2026-03-26 15:39:35]** 🚀 Fry started working on this task.

---
**[2026-03-26 15:42:10]** 🚀 Fry started working on this task.

---
**[2026-03-26 15:45:01]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
