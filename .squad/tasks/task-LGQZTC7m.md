---
id: task-LGQZTC7m
title: Wire agent-skill assignment UI
status: done
priority: P0
assignee: fry
labels:
  - 'parent:task-Too8OrT7'
created: '2026-03-26T18:05:28.283Z'
updated: '2026-03-26T18:33:26.889Z'
sortIndex: 205
---
Implement the /skills/agents/[agentId] page using AgentSkillList. Support attaching/detaching skills to agents via POST/DELETE /api/agents/:id/skills. Add drag-and-drop reordering with @dnd-kit using the useReorderAgentSkills hook. Show skill phase badges and enable/disable toggles per agent.

---
**[2026-03-26 18:33:26]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 18:27:17]** 🧠 Thinking: Let me start by exploring the codebase to understand the project structure, existing patterns, and what components/hooks are already available before 
**[2026-03-26 18:27:17]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:17]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:17]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:24]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:24]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:32]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🧠 Thinking: Now let me look at the existing AgentSkillList component, the skill-phase-badge, the API client, existing page patterns, and package.json for dnd-kit.
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:50]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:50]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:50]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:50]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:51]** 🧠 Thinking: Let me check the existing page, the API client, the API routes, and the layout patterns to understand how to implement this properly.
**[2026-03-26 18:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 18:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:19]** 🧠 Thinking: Let me understand what's already in place and what needs to be done:

1. **Page `/skills/agents/[agentId]/page.tsx`** - Already exists! It's a basic p
**[2026-03-26 18:28:19]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:19]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:19]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:19]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:24]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:24]** 🔧 Using tool: `unknown`
**[2026-03-26 18:28:28]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:05]** 🧠 Thinking: OK, I have a thorough understanding of the codebase now. Let me analyze what needs to be done:

The page at `/skills/agents/[agentId]/page.tsx` alread
**[2026-03-26 18:29:05]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:05]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:05]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:05]** ℹ️ /Users/matancohen/.copilot/session-state/945f9d86-97ab-474b-8647-6febe0092b60/plan.md
**[2026-03-26 18:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:20]** 🧠 Thinking: Now I have a comprehensive understanding. Let me get to work on the implementation. Let me also add todo dependencies.

The explore agent confirmed ev
**[2026-03-26 18:29:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:31]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:45]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:29:58]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:06]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:23]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:43]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:43]** 🔧 Using tool: `unknown`
**[2026-03-26 18:30:44]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/available-skills-panel.tsx
**[2026-03-26 18:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:20]** 🧠 Thinking: I see - the vitest config resolves `@` to `./src`, but the tsconfig has `@/*` mapping to both `./app/*` and `./src/*`. The test for the store page imp
**[2026-03-26 18:31:20]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:31:56]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/__tests__/agent-skill-config-page.test.tsx
**[2026-03-26 18:32:03]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:03]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:03]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:12]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:22]** 🧠 Thinking: There are 2 failed test files with 3 failed tests, but let me check if these failures existed before my changes. Let me look at which tests failed:
**[2026-03-26 18:32:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:30]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:45]** 🔧 Using tool: `unknown`
**[2026-03-26 18:32:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:33:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:33:13]** 🔧 Using tool: `unknown`
**[2026-03-26 18:33:13]** 🔧 Using tool: `unknown`

**[2026-03-26 18:33:26]** ✅ Fry completed this task.

**Result:**
All done! Here's a summary of what I implemented:

## Summary

**5 files changed/created** to wire the agent-skill assignment UI:

1. **`src/hooks/use-skills.ts`** — Added two new mutation hooks:
   - `useAttachAgentSkill(agentId)` — calls `POST /api/agents/:id/skills` to assign a skill
   - `useDetachAgentSkill(agentId)` — calls `DELETE /api/agents/:id/skills/:skillId` with optimistic removal

2. **`src/components/skills/agent-skill-list.tsx`** — Added a **detach (trash) button** to each `SortableSkillRow` that removes a skill from the agent

3. **`src/components/skills/available-skills-panel.tsx`** *(new)* — Shows unassigned skills with search, phase badges, tags, and an **"Assign" button** per skill

4. **`app/skills/agents/[agentId]/page.tsx`** — Added an **"Add Skills"** toggle button that reveals the `AvailableSkillsPanel` above the assigned list

5. **`__tests__/agent-skill-config-page.test.tsx`** *(new)* — **18 tests** covering: page rendering, assign/detach UI, available skills filtering, loading/empty states, phase badges, toggles, drag handles

✅ All 18 new tests pass | ✅ No TypeScript errors in changed files | ✅ No regressions in existing tests
