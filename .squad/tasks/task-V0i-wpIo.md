---
id: task-V0i-wpIo
title: Auto-merge PRs when CI passes
status: delegated
priority: P0
assignee: leela
labels: []
created: '2026-03-31T21:11:05.904Z'
updated: '2026-03-31T21:17:55.031Z'
sortIndex: 334
---
Close the loop: after an agent creates a PR, monitor CI status. When all checks pass, auto-merge the PR and clean up the worktree + branch. Use gh pr merge --auto or poll gh pr checks. Add a merge:auto label to track. Update task status to done only after merge completes. This removes the last manual step in the agent workflow.

---
**[2026-03-31 21:11:05]** 🚀 Leela started working on this task.
**[2026-03-31 21:11:05]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-31 21:17:55]** 📋 Leela broke this task into 3 sub-tasks:

- **Implement PRAutoMergeService and extend GitHubService** → Bender (Backend Dev)
- **Show PR merge status on task cards** → Fry (Frontend Dev)
- **Test auto-merge flow end-to-end** → Zoidberg (Tester)
**Feature Branch:** `feature/task-V0i-wpIo`


**[2026-03-31 21:17:55]** 🔀 Task delegated — waiting for subtask completion.
