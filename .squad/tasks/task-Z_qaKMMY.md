---
id: task-Z_qaKMMY
title: Design skill manifest schema & plugin architecture
status: done
priority: P1
assignee: leela
labels:
  - architecture
  - design
  - skills
  - 'parent:task-hgTK5Dbi'
created: '2026-03-25T23:19:39.369Z'
updated: '2026-03-31T21:51:04.876Z'
sortIndex: 102
---
Define the skill manifest format (JSON/YAML) including: skill metadata (name, version, description), required tools declarations, prompt templates with variable interpolation, task-type matching rules, and dependency declarations. Design the plugin lifecycle (discover → validate → load → activate → deactivate). Document the contract between skills and the agent runtime. Output: architecture doc + TypeScript interfaces for SkillManifest, SkillContext, SkillRegistry.

---
**[2026-03-26 00:22:28]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:25:17]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:34:04]** 🚀 Leela started working on this task.

**Progress:**
**[2026-03-26 00:27:25]** 🧠 Thinking: Let me analyze this task. I need to:

1. Design a skill manifest schema and plugin architecture
2. Create TypeScript interfaces for SkillManifest, Ski
**[2026-03-26 00:27:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:30]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:27:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:28:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:15]** 🧠 Thinking: Excellent - I now have a comprehensive understanding of the codebase. Let me design the skill manifest schema and plugin architecture. Key observation
**[2026-03-26 00:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:29:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:30:59]** 🧠 Thinking: Now I have a very thorough understanding of the codebase. Let me design the skill manifest schema and plugin architecture. Key observations:

1. There
**[2026-03-26 00:30:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:30:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:31:00]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/types/skill.ts
**[2026-03-26 00:31:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:11]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/docs/skill-manifest-architecture.md
**[2026-03-26 00:33:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:29]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:33:46]** 🔧 Using tool: `unknown`

**[2026-03-26 00:34:04]** ✅ Leela completed this task.

**Result:**
Committed cleanly — lint + prettier passed. Here's what I delivered:

**3 files created/modified:**

1. **`packages/shared/src/types/skill.ts`** — TypeScript interfaces (~500 lines):
   - `SkillManifest` — declarative skill definition with metadata, tool declarations, prompt templates (`{{var}}` interpolation with conditionals/iteration), task-type matching triggers (5 types: task-type, label, pattern, file, composite), dependency declarations, config schema, permissions
   - `SkillContext` — runtime context with scoped `SkillToolkit`, task context, agent ref, config, mutable vars, inter-skill comms, logger, events
   - `SkillRegistry` — full plugin lifecycle interface: `discover()` → `validate()` → `load()` → `activate()` ⇄ `deactivate()` → `unload()`, plus `matchTask()` with confidence scoring and `getActivePrompts()` for merged prompt rendering
   - `SkillLifecycleHooks` — optional imperative hooks via `entryPoint`
   - Supporting types: triggers, templates, match results, validation, events, errors

2. **`docs/skill-manifest-architecture.md`** — Architecture doc covering manifest format, lifecycle phases, prompt engine, task matching, runtime contract (guarantees both ways), integration points (AgentRegistry, DAG Workflow, A2A), and migration path

3. **`packages/shared/src/types/index.ts`** — Barrel exports updated with all 44 new skill types
