---
id: task-jmiqAKo4
title: E2E tests for skills UI flows
status: done
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-Too8OrT7'
created: '2026-03-26T18:05:28.314Z'
updated: '2026-03-26T18:21:01.073Z'
sortIndex: 206
---
Write Playwright E2E tests covering: (1) skills listing page loads and displays built-in skills, (2) search/filter by tag and phase works, (3) clicking a skill navigates to detail page with correct tabs, (4) skill creation wizard completes successfully and new skill appears in listing, (5) agent-skill assignment attach/detach works. Use the existing playwright.config.ts setup.

---
**[2026-03-26 18:05:28]** 🚀 Zoidberg started working on this task.

---
**[2026-03-26 18:10:54]** 🚀 Zoidberg started working on this task.

---
**[2026-03-26 18:21:01]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 18:15:40]** 🧠 Thinking: Let me start by exploring the codebase to understand the project structure, existing Playwright setup, and the skills UI that I need to test.
**[2026-03-26 18:15:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:55]** 🔧 Using tool: `unknown`
**[2026-03-26 18:15:55]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:00]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:00]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:02]** 🧠 Thinking: Good, I can see there's already an existing `skill-store.spec.ts` with some tests. Let me wait for the explore agent to come back with more detail, an
**[2026-03-26 18:16:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:07]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:09]** 🧠 Thinking: Now I have a good picture. Let me look at the key components more closely - the skill creation wizard, skill filters toolbar, agent-skill-list, skill 
**[2026-03-26 18:16:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:14]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:16]** 🧠 Thinking: Let me now look at the skills hooks, the API routes for skills, and the skill detail page to understand the full picture.
**[2026-03-26 18:16:16]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:16]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:16]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:16]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:18]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:18]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:18]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:25]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:25]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:26]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:26]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:29]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:29]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:29]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:31]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:31]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:31]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:33]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:36]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:37]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:40]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:48]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:48]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:48]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:48]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:53]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:57]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:57]** 🔧 Using tool: `unknown`
**[2026-03-26 18:16:57]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:36]** 🧠 Thinking: Now I have a thorough understanding of the codebase. Let me check the existing `skill-store.spec.ts` and understand what's already tested vs what need
**[2026-03-26 18:17:36]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:36]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:36]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:43]** 🔧 Using tool: `unknown`
**[2026-03-26 18:17:52]** 🔧 Using tool: `unknown`
**[2026-03-26 18:18:04]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me also check the explore agent results, then I'll create the plan and write the tests.

**[2026-03-26 18:18:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:18:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:18:04]** 🔧 Using tool: `unknown`
**[2026-03-26 18:18:04]** ℹ️ /Users/matancohen/.copilot/session-state/e6ae8eb1-d501-4f51-ae74-2a714f98ebd0/plan.md
**[2026-03-26 18:18:09]** 🔧 Using tool: `unknown`
**[2026-03-26 18:19:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:19:56]** 🔧 Using tool: `unknown`
**[2026-03-26 18:19:56]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/e2e/skills-ui-flows.spec.ts
**[2026-03-26 18:20:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:02]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:10]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:22]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:30]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:41]** 🔧 Using tool: `unknown`
**[2026-03-26 18:20:49]** 🔧 Using tool: `unknown`

**[2026-03-26 18:21:01]** ✅ Zoidberg completed this task.

**Result:**
Done. Here's the summary:

**Created `e2e/skills-ui-flows.spec.ts`** with **40 tests** across 8 describe blocks covering all 5 required flows:

| Flow | Tests | Approach |
|---|---|---|
| **1. Skills listing** | 5 | Verifies heading, all 8 built-in skill cards, names/tags, card count |
| **2. Search/filter** | 7 | Text search, tag filter (`core`), phase filter (`Loaded`), combined filters, clear, empty state, result count |
| **3. Skill detail nav** | 7 | Card click → URL, all 4 tabs present, Overview default selected, each tab clickable, back button, 404 handling |
| **4. Creation wizard** | 5 | Dialog open, step nav (Next/Back), sidebar nav, full JSON editor flow creating a skill, visual editor basics step |
| **5. Agent-skill assignment** | 11 | API-driven assign/detach, verify via `/agents` endpoint, full lifecycle with custom skill, multi-agent assignment, 404/400 edge cases |
| **Edge cases** | 5 | API schema validation, required fields, 404 for missing skills |

Tests use the existing `playwright.config.ts` setup, proper `data-testid` selectors from the actual components, and API helpers for setup/teardown.
