---
id: task-j7_j9Nnr
title: 'Add new reference skills (docs-writer, security-scanner)'
status: done
priority: P0
assignee: bender
labels:
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:19.712Z'
updated: '2026-03-26T15:31:57.516Z'
sortIndex: 198
---
Create 2 new reference skills in /packages/skills-core/src/: (1) docs-writer — generates and updates documentation using file:read, file:write tools; (2) security-scanner — analyzes code for vulnerabilities using static analysis tool declarations. Each needs manifest.json, prompts/, and tools/ directories following the existing git-expert pattern.

---
**[2026-03-26 15:31:57]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 15:27:06]** 🧠 Thinking: Let me start by understanding the existing structure, particularly the git-expert skill pattern, so I can replicate it for the two new skills.
**[2026-03-26 15:27:06]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:06]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:06]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:10]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:18]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:18]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:23]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:26]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:26]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:30]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:33]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:33]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:36]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:41]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:27:44]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:38]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:42]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:42]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:46]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:46]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:46]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:28:56]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/prompts/vulnerability-scan.md
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/docs-writer/manifest.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/manifest.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/tools/static-analysis-scan.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/prompts/threat-model.md
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/docs-writer/tools/file-write.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/tools/static-analysis-dependency-check.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/security-scanner/tools/static-analysis-secret-detect.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/docs-writer/tools/file-read.json
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/docs-writer/prompts/generate-docs.md
**[2026-03-26 15:31:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/skills-core/src/docs-writer/prompts/update-docs.md
**[2026-03-26 15:31:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:09]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:13]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:17]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:21]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:26]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:26]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:31]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:36]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:40]** 🔧 Using tool: `unknown`
**[2026-03-26 15:31:46]** 🔧 Using tool: `unknown`

**[2026-03-26 15:31:57]** ✅ Bender completed this task.

**Result:**
Done. Here's the summary:

**Created 2 new reference skills** following the git-expert pattern:

**docs-writer** (6 files):
- `manifest.json` — declares `file:read`, `file:write` tools; prompts for generate-docs and update-docs; triggers on documentation task types
- `prompts/generate-docs.md` — multi-step workflow for generating READMEs, API refs, architecture docs
- `prompts/update-docs.md` — workflow for updating existing docs after code changes
- `tools/file-read.json`, `tools/file-write.json` — tool declarations

**security-scanner** (6 files):
- `manifest.json` — declares `static-analysis:scan`, `static-analysis:dependency-check`, `static-analysis:secret-detect` tools; prompts for vulnerability-scan and threat-model
- `prompts/vulnerability-scan.md` — OWASP-aligned scan workflow with severity ratings
- `prompts/threat-model.md` — STRIDE/DREAD/attack-tree threat modeling
- `tools/static-analysis-scan.json`, `tools/static-analysis-dependency-check.json`, `tools/static-analysis-secret-detect.json`

**Updated**: `index.ts` (SKILL_IDS array + doc comment), `manifests.test.ts` (count assertions + toolId regex). All 112 tests pass.
