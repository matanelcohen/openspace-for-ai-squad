---
id: task-bbHCI4xI
title: Add skill creation wizard UI
status: done
priority: P0
assignee: fry
labels:
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:19.639Z'
updated: '2026-03-31T21:51:05.039Z'
sortIndex: 135
---
Build a new skill creation wizard in /apps/web/src/components/skills/ that guides users through authoring a skill manifest (name, tools, triggers, prompts, config). Include a JSON/YAML editor with live validation against the manifest schema, and a preview pane showing how the skill card will appear in the skill-grid.

---
**[2026-03-26 15:28:22]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 15:16:34]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the apps/web directory and any existing skill-related components. I'll explore the 
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:19]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:19]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:19]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:19]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:21]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:24]** 🧠 Thinking: Excellent! I have a comprehensive understanding of the codebase. Now let me create a plan and start implementing the skill creation wizard. Let me loo
**[2026-03-26 15:18:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:37]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:27]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me create the plan and then implement the skill creation wizard. Here's what I need to b
**[2026-03-26 15:19:27]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:27]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:27]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:27]** ℹ️ /Users/matancohen/.copilot/session-state/c3234edb-4f55-4f9e-b2ab-875a2d4e7e78/plan.md
**[2026-03-26 15:20:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:20:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:20:10]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-skill-manifest-form.ts
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:55]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-step-basics.tsx
**[2026-03-26 15:21:55]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-step-tools.tsx
**[2026-03-26 15:21:55]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-step-config.tsx
**[2026-03-26 15:21:55]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-step-triggers.tsx
**[2026-03-26 15:21:55]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-step-prompts.tsx
**[2026-03-26 15:22:32]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:32]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:32]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:32]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/manifest-editor.tsx
**[2026-03-26 15:22:32]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/wizard-types.ts
**[2026-03-26 15:22:32]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/skill-card-preview.tsx
**[2026-03-26 15:23:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:23:09]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/skill-creation-wizard.tsx
**[2026-03-26 15:24:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:04]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/skills/__tests__/skill-creation-wizard.test.tsx
**[2026-03-26 15:24:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:18]** 🧠 Thinking: The `@/` alias might not be resolving properly in the test. Let me check the vitest config for the alias.
**[2026-03-26 15:24:18]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:18]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:29]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:58]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:07]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:07]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:14]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:20]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:31]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:00]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:26]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:35]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:40]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:48]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:02]** 🧠 Thinking: It seems the first commit (before lint-staged reverted) did include all files, but the stash/revert process may have restored older versions. The seco
**[2026-03-26 15:28:02]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:09]** 🔧 Using tool: `unknown`

**[2026-03-26 15:28:22]** ✅ Fry completed this task.

**Result:**
No uncommitted changes. Everything is committed. Here's what I built:

## ✅ Skill Creation Wizard — Complete!

**12 new files** across the skill wizard UI:

| File | Purpose |
|------|---------|
| `skill-creation-wizard.tsx` | Main dialog with 5-step sidebar nav, form/JSON tabs, preview pane |
| `wizard-step-basics.tsx` | Step 1: Name, ID, version, description, author, icon, tags |
| `wizard-step-tools.tsx` | Step 2: Add/remove tool declarations with optional/version/reason |
| `wizard-step-triggers.tsx` | Step 3: Task-type, label, pattern, file trigger rules |
| `wizard-step-prompts.tsx` | Step 4: Prompt templates with role, content, variables |
| `wizard-step-config.tsx` | Step 5: Config schema parameters with types & defaults |
| `manifest-editor.tsx` | JSON editor with live syntax + schema validation |
| `skill-card-preview.tsx` | Live preview matching existing SkillCard design |
| `wizard-types.ts` | Shared action types for dispatch |
| `use-skill-manifest-form.ts` | useReducer-based form state, validation, serialization |
| `use-skills.ts` | Added `useCreateSkill` mutation hook |
| `skill-creation-wizard.test.tsx` | **28 tests** — all passing ✅ |
