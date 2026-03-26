---
id: task-pDRUwFXt
title: Test skill plugin system end-to-end
status: done
priority: P2
assignee: zoidberg
labels:
  - testing
  - QA
  - skills
  - e2e
  - unit-tests
  - 'parent:task-hgTK5Dbi'
created: '2026-03-25T23:19:39.419Z'
updated: '2026-03-26T07:46:22.084Z'
sortIndex: 157
---
Write tests covering: 1) Unit tests for SkillRegistry discovery, SkillLoader validation (valid/invalid manifests, missing deps, circular deps), and SkillRouter task matching. 2) Integration tests for skill lifecycle (load → attach to agent → execute task → detach). 3) E2E tests: agent receives a git-related task → router selects git-expert skill → skill tools and prompts are injected → agent produces correct output. 4) Edge cases: malformed manifests, duplicate skill names, skill hot-reload, concurrent skill loading. Target 90%+ coverage on the registry/loader/router modules.

---
**[2026-03-26 07:46:22]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 07:29:36]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the skill plugin system that I need to test. I'll explore the repository to find th
**[2026-03-26 07:29:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:38]** 🔧 Using tool: `unknown`
**[2026-03-26 07:30:38]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🧠 Thinking: Now I have a comprehensive understanding of the skill plugin system. Let me now read the actual source files for the key modules I need to test:

1. `
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:34]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:34]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:34]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:55]** 🔧 Using tool: `unknown`
**[2026-03-26 07:31:55]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:25]** 🧠 Thinking: Now I have a complete understanding of the codebase. Let me create a comprehensive plan and then implement the tests. I need to create:

1. **Unit tes
**[2026-03-26 07:32:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:25]** ℹ️ /Users/matancohen/.copilot/session-state/6b23a973-a2af-4445-aecc-f0d9be4a2363/plan.md
**[2026-03-26 07:32:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:32:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:34:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:34:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:34:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:34:45]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/skill-loader.test.ts
**[2026-03-26 07:34:45]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/skill-router.test.ts
**[2026-03-26 07:34:45]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/skill-isolation.test.ts
**[2026-03-26 07:37:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:17]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/e2e-skill-registry.test.ts
**[2026-03-26 07:37:17]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/skill-registry.test.ts
**[2026-03-26 07:37:18]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/skill-registry/__tests__/edge-cases.test.ts
**[2026-03-26 07:37:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:37:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:38:37]** 🧠 Thinking: I see several issues:

1. Many integration tests are failing because the validation fails with "error" phase. The issue seems to be that the `exec:git
**[2026-03-26 07:38:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:38:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:38:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:38:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:13]** 🧠 Thinking: The real skill manifests use `"exec:git"` and `"exec:lint"` which are NOT in the Ajv schema enum:
```
enum: ['fs:read', 'fs:write', 'net:outbound', 'e
**[2026-03-26 07:39:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:21]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:54]** 🧠 Thinking: The issue is that `__dirname` has 7 path segments from the repo root (`apps/api/src/services/skill-registry/__tests__`), but I used 7 `..`'s in the pa
**[2026-03-26 07:39:54]** 🔧 Using tool: `unknown`
**[2026-03-26 07:39:54]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:00]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:27]** 🧠 Thinking: The test-runner manifest uses `patterns` instead of `globs`. This is a mismatch between the manifest and the `FileTrigger` type which expects `globs`.
**[2026-03-26 07:40:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:40:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:21]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:46]** 🔧 Using tool: `unknown`
**[2026-03-26 07:41:54]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:30]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:42:58]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:41]** 🧠 Thinking: I need to add back the line I accidentally removed. Let me look at the context:
**[2026-03-26 07:43:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:43:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:38]** 🧠 Thinking: These are pre-existing lint issues in index.ts. My change only affected one line. Let me check which errors are from my change vs pre-existing.

My ch
**[2026-03-26 07:44:38]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:44:58]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:11]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:25]** 🧠 Thinking: Two real errors left:
1. In skill-router.test.ts at line 169, `entries` is unused - I messed up the edit earlier
2. In skill-router.test.ts at line 17
**[2026-03-26 07:45:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:39]** 🔧 Using tool: `unknown`
**[2026-03-26 07:45:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:46:06]** 🔧 Using tool: `unknown`

**[2026-03-26 07:46:22]** ✅ Zoidberg completed this task.

**Result:**
Committed. Here's the summary:

## Summary

**Created 6 test files with 163 tests** covering the skill plugin system end-to-end:

| Test File | Tests | What it covers |
|---|---|---|
| `skill-loader.test.ts` | 44 | Discovery (JSON/YAML/malformed), validation (schema, duplicates, path traversal), circular deps, topological sort, manifest resolution |
| `skill-router.test.ts` | 26 | All 5 trigger types, confidence scoring (0.9/0.8/0.7/0.6), composite AND/OR, phase filtering, sorting |
| `skill-isolation.test.ts` | 21 | Hook execution with timeout/error isolation, all safe* wrappers (null/success/failure) |
| `skill-registry.test.ts` | 39 | Full lifecycle integration, events, filtering (phase/tags/agent), multi-agent, discoverAndLoadAll |
| `e2e-skill-registry.test.ts` | 8 | Real manifests: git task → git-expert routing → tool/prompt injection → full lifecycle |
| `edge-cases.test.ts` | 25 | Malformed manifests, duplicate names, hot-reload, concurrent loading, boundary conditions |

**Coverage: 91% statements, 91.5% lines** on registry/loader/router/isolation.

**Found and fixed 2 bugs:**
1. `validate()` passed resolved manifest (with extra fields) to Ajv's `additionalProperties:false` — stripped resolved fields before validation
2. Permissions schema used strict enum rejecting valid `exec:git`/`exec:lint` — switched to pattern-based validation
