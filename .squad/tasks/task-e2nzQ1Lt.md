---
id: task-e2nzQ1Lt
title: Implement PRAutoMergeService and extend GitHubService
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-V0i-wpIo'
created: '2026-03-31T21:17:54.845Z'
updated: '2026-03-31T21:44:13.988Z'
sortIndex: 339
parent: task-V0i-wpIo
---
1) Extend GitHubService (apps/api/src/services/github/index.ts) with: getPRChecks(prNumber) using `gh pr checks --json`, mergePR(prNumber, strategy='squash') using `gh pr merge --squash --auto`, and enableAutoMerge(prNumber). 2) Create new PRAutoMergeService (apps/api/src/services/pr-auto-merge/index.ts) that polls every 60s, finds tasks with `merge:auto` label, checks CI status via getPRChecks, merges when all checks pass, then cleans up worktree+branch via WorktreeService.destroy() and deletes remote branch. After merge: update task status to 'done', remove `merge:auto` label, add `merged` label. 3) Update agent-worker (apps/api/src/services/agent-worker/index.ts lines 655-692): after PR creation, add `merge:auto` label to task instead of setting status to 'done' — set status to 'in-progress' with a note that PR is awaiting CI. 4) Register PRAutoMergeService in apps/api/src/app.ts and start its polling loop. 5) Add GET /api/github/prs/:number/checks route in apps/api/src/routes/github.ts.

---
**[2026-03-31 21:17:54]** 🚀 Bender started working on this task.
**[2026-03-31 21:17:54]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:24:44]** 🚀 Bender started working on this task.
**[2026-03-31 21:24:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:24:44]** 🚀 Bender started working on this task.
**[2026-03-31 21:24:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:03]** 🚀 Bender started working on this task.

---
**[2026-03-31 21:25:03]** 🚀 Bender started working on this task.
**[2026-03-31 21:25:03]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:09]** 🛑 Permanently blocked after 5 failed attempts.

---
**[2026-03-31 21:44:13]** ❌ **BLOCKED** — bender failed.

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
