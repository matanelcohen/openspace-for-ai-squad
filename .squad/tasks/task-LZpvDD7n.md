---
id: task-LZpvDD7n
title: Write tests for code review flow
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-l8ICv8lq'
created: '2026-03-31T21:21:03.750Z'
updated: '2026-03-31T21:25:31.090Z'
sortIndex: 344
parent: task-l8ICv8lq
---
Create `apps/api/src/services/code-review/__tests__/code-review.test.ts` with unit tests: 1) Test CodeReviewService.reviewPR calls githubService.diffPR with correct PR number. 2) Test it sends diff to aiProvider.chatCompletion with the review system prompt. 3) Test it calls githubService.reviewPR with APPROVE when LLM returns { approved: true }. 4) Test it calls githubService.reviewPR with REQUEST_CHANGES when LLM returns { approved: false }. 5) Test error handling — if diffPR throws, reviewPR gracefully fails. Mock GitHubService and AIProvider. Also add a test in `apps/api/src/services/agent-worker/__tests__/` verifying that when worktree PR creation succeeds and codeReviewService is configured, reviewPR is called. Use vitest (the project's test runner). Follow patterns from existing tests like memory-integration.test.ts.

---
**[2026-03-31 21:25:10]** 🚀 Zoidberg started working on this task.
**[2026-03-31 21:25:10]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:21]** 🚀 Zoidberg started working on this task.
**[2026-03-31 21:25:21]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:25:30]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-LZpvDD7n' -b 'task/task-LZpvDD7n' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-LZpvDD7n')
fatal: a branch named 'task/task-LZpvDD7n' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-LZpvDD7n' -b 'task/task-LZpvDD7n' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-LZpvDD7n')
fatal: a branch named 'task/task-LZpvDD7n' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```

---
**[2026-03-31 21:25:31]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-LZpvDD7n' -b 'task/task-LZpvDD7n' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-LZpvDD7n')
fatal: a branch named 'task/task-LZpvDD7n' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-LZpvDD7n' -b 'task/task-LZpvDD7n' 'feature/task-l8ICv8lq'
Preparing worktree (new branch 'task/task-LZpvDD7n')
fatal: a branch named 'task/task-LZpvDD7n' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```
