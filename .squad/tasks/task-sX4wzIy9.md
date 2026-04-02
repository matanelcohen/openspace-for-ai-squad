---
id: task-sX4wzIy9
title: Replace N+1 hooks and hardcoded 4-agent limit on frontend
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-HprYEdcG'
created: '2026-04-02T02:00:40.701Z'
updated: '2026-04-02T02:00:42.508Z'
sortIndex: 591
parent: task-HprYEdcG
dependsOn:
  - task-mySPK3N3
---
Three files need changes:

1. **`apps/web/src/hooks/use-skills.ts`**: Add a new `useAllAgentSkills()` hook that calls `GET /api/agents/skills/batch` once and returns a `Map<agentId, AgentSkillEntry[]>`. Use `useQuery` with queryKey `['agent-skills-batch']`.

2. **`apps/web/app/skills/[id]/page.tsx`**: In `SkillAgentsList`, call the new `useAllAgentSkills()` once at the list level. Pass the pre-fetched skills data down to `SkillAgentRow` as a prop instead of each row calling `useAgentSkillsManagement(agent.id)` individually. This eliminates the N+1.

3. **`apps/web/src/components/skills/skill-grid.tsx`**: Remove the hardcoded `e0`–`e3` hooks and `.slice(0, 4)` calls. Replace `useSkillAgentMap` with a version that uses the new `useAllAgentSkills()` batch hook, dynamically handling any number of agents. This removes the silent 4-agent cap.
