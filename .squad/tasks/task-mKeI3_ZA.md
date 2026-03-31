---
id: task-mKeI3_ZA
title: Show PR merge status on task cards
status: blocked
priority: P0
assignee: fry
labels:
  - 'parent:task-V0i-wpIo'
created: '2026-03-31T21:17:54.924Z'
updated: '2026-03-31T21:31:23.029Z'
sortIndex: 340
parent: task-V0i-wpIo
---
In the web frontend (apps/web/), update task card components to: 1) Detect `merge:auto` label and show a 'CI Pending' / 'Auto-merge enabled' badge with a spinner/icon. 2) Detect `pr:NUMBER` label and render a clickable PR link. 3) Detect `merged` label and show a 'Merged ✓' success badge. 4) If a task has `merge:auto`, poll GET /api/github/prs/:number/checks every 30s to show live CI status (passing/failing/pending) on the card. Use the existing task label patterns — no new data model needed. Check apps/web/src for the task list/card components and add the status indicators there.

---
**[2026-03-31 21:17:54]** 🚀 Fry started working on this task.
**[2026-03-31 21:17:54]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:24:44]** 🚀 Fry started working on this task.
**[2026-03-31 21:24:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:24:44]** 🚀 Fry started working on this task.
**[2026-03-31 21:24:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:24:46]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.

---
**[2026-03-31 21:31:23]** ❌ **BLOCKED** — fry failed.

**Error:** spawnSync /bin/sh ENOENT

**Stack:** ```
Error: spawnSync /bin/sh ENOENT
    at Object.spawnSync (node:internal/child_process:1120:20)
    at spawnSync (node:child_process:902:24)
    at execSync (node:child_process:983:15)
    at WorktreeService.gitInDir (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/worktree/index.ts:487:12)
    at WorktreeService.commit (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/worktree/index.ts:228:25)
    at AgentWorkerService.processNext (/Users/matancohe
```
