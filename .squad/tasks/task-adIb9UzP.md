---
id: task-adIb9UzP
title: Enhance skill router matching logic
status: done
priority: P0
assignee: bender
labels:
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:19.575Z'
updated: '2026-03-26T15:26:53.540Z'
sortIndex: 195
---
Improve the SkillRouter in /apps/api/src/services/skill-registry/skill-router.ts to support weighted composite triggers, fuzzy pattern matching, and skill priority tiebreaking. Currently confidence scores are static (task-type: 0.9, label: 0.8, pattern: 0.7, file: 0.6) — make them configurable per-skill and add support for learned relevance adjustments.

---
**[2026-03-26 15:26:53]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 15:16:29]** 🧠 Thinking: Let me start by understanding the current codebase structure and the skill router implementation.
**[2026-03-26 15:16:29]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:29]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:43]** 🧠 Thinking: Now I need to see the types to understand the interfaces I'm working with.
**[2026-03-26 15:16:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:48]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 15:16:57]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:04]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:04]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:04]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:04]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:25]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me plan the implementation:

1. **Configurable confidence scores per skill** - Add optio
**[2026-03-26 15:17:25]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:25]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:25]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:25]** ℹ️ /Users/matancohen/.copilot/session-state/476f41af-002d-4456-b38e-551f0d0edf58/plan.md
**[2026-03-26 15:17:29]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:29]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:41]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:41]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:47]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:55]** 🔧 Using tool: `unknown`
**[2026-03-26 15:17:59]** 🔧 Using tool: `unknown`
**[2026-03-26 15:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:24]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:42]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:42]** 🔧 Using tool: `unknown`
**[2026-03-26 15:19:42]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:15]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:20]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:28]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:28]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:28]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:35]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:39]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:21:49]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:04]** 🧠 Thinking: These are pre-existing tests. Let me understand the failures:

1. "file triggers always produce 0.6 confidence" - The test uses `makeEntry` but the pr
**[2026-03-26 15:22:04]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:21]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:50]** 🧠 Thinking: So on main, only 26 tests exist and they all pass. The 2 failures are in the edge-cases.test.ts file, not the skill-router.test.ts. Wait, let me re-re
**[2026-03-26 15:22:50]** 🔧 Using tool: `unknown`
**[2026-03-26 15:22:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:23:06]** 🧠 Thinking: I see that other files have been modified by other people (edge-cases.test.ts, skill-loader.test.ts). These pre-existing changes from other teammates'
**[2026-03-26 15:23:06]** 🔧 Using tool: `unknown`
**[2026-03-26 15:23:11]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:01]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:05]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:12]** 🧠 Thinking: Wait, the test at line 1340 already has `deploy/config.yaml` which should match `**/*.yaml`. Let me look more carefully at the original (before stash 
**[2026-03-26 15:24:12]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:35]** 🧠 Thinking: The file at line 1340 has `deploy/config.yaml` which should match `**/*.yaml` properly (has a `/` in the path). Let me look at the original error mess
**[2026-03-26 15:24:35]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:43]** 🧠 Thinking: Wait, it passed now? Let me check if my fix to the other test somehow fixed the issue. No, I only changed the `file triggers always produce 0.6 confid
**[2026-03-26 15:24:43]** 🔧 Using tool: `unknown`
**[2026-03-26 15:24:52]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:01]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:12]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:32]** 🧠 Thinking: The module resolution errors are pre-existing (they use the same import path as the original code). The `TS2532: Object is possibly 'undefined'` at li
**[2026-03-26 15:25:32]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:41]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:45]** 🔧 Using tool: `unknown`
**[2026-03-26 15:25:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:15]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:20]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:25]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:34]** 🔧 Using tool: `unknown`
**[2026-03-26 15:26:42]** 🔧 Using tool: `unknown`

**[2026-03-26 15:26:53]** ✅ Bender completed this task.

**Result:**
Done. Here's what I shipped:

**Types** (`packages/shared/src/types/skill.ts`):
- `SkillConfidenceWeights` — per-skill confidence overrides for each trigger type
- `SkillManifest.priority` — tiebreaking when confidence scores are equal
- `SkillManifest.confidenceWeights` — per-skill weight config
- `PatternTrigger.fuzzy` — fuzzy matching config (terms, maxDistance, minSimilarity)
- `CompositeTrigger.strategy` — `min|max|avg|weighted-avg` aggregation
- `CompositeTrigger.weights` — per-child weights for `weighted-avg`
- `SkillMatchResult.priority`, `.relevanceAdjustment`, `.rawConfidence`

**Router** (`apps/api/src/services/skill-registry/skill-router.ts`):
- Configurable defaults + per-skill confidence overrides (cascade: global → per-skill)
- Levenshtein fuzzy matching engine with similarity scoring
- Weighted composite strategies (`avg`, `weighted-avg` alongside existing `min`/`max`)
- Priority-based tiebreaking in sort
- `RelevanceStore` interface + `InMemoryRelevanceStore` for learned adjustments (clamped, incremental feedback)
- Fully backward compatible — `matchTaskToSkills(entries, task)` still works with no options

**Tests**: 84 passing (26 original + 58 new covering all enhanced features).
