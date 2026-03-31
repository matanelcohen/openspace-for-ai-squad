---
id: task-T7OtSxQU
title: Add diffPR/reviewPR to GitHubService + create CodeReviewService
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-l8ICv8lq'
created: '2026-03-31T21:21:03.651Z'
updated: '2026-03-31T22:35:35.607Z'
sortIndex: 342
parent: task-l8ICv8lq
---
1) Add `diffPR(prNumber: number): string` to GitHubService that runs `gh pr diff <number>` and returns the raw diff. 2) Add `reviewPR(prNumber: number, opts: { event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'; body: string })` that runs `gh pr review <number> --event <event> --body-file <tmpFile>`. Use the existing temp-file pattern from createPR for the body. 3) Create new `apps/api/src/services/code-review/index.ts` with a `CodeReviewService` class. Constructor takes `{ githubService, aiProvider, reviewerAgentId }`. Main method: `async reviewPR(prNumber: number, taskContext: { title: string; agentName: string }): Promise<{ approved: boolean; comments: string }>` — fetches diff via githubService.diffPR, sends to aiProvider.chatCompletion with a system prompt instructing analysis for bugs/security/logic errors, parses the LLM response to decide APPROVE vs REQUEST_CHANGES, then calls githubService.reviewPR. The system prompt should say: 'You are a code reviewer. Analyze this PR diff for bugs, security issues, and logic errors. Respond with JSON: { approved: boolean, summary: string }'. File: apps/api/src/services/github/index.ts (edit), apps/api/src/services/code-review/index.ts (create).

---
**[2026-03-31 21:25:10]** 🚀 Bender started working on this task.
**[2026-03-31 21:25:10]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:22]** 🚀 Bender started working on this task.
**[2026-03-31 21:25:22]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:23]** 🚀 Bender started working on this task.
**[2026-03-31 21:25:23]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:30]** ❌ **BLOCKED** — bender failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```

---
**[2026-03-31 21:25:31]** ❌ **BLOCKED** — bender failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```

---
**[2026-03-31 22:35:32]** 🚀 Bender started working on this task.
**[2026-03-31 22:35:32]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 22:35:35]** ❌ **BLOCKED** — bender failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-T7OtSxQU' -b 'task/task-T7OtSxQU' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-T7OtSxQU')
fatal: a branch named 'task/task-T7OtSxQU' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```
