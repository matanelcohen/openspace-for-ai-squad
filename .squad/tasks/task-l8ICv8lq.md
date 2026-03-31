---
id: task-l8ICv8lq
title: Add code review agent to PR workflow
status: delegated
priority: P0
assignee: leela
labels: []
created: '2026-03-31T21:11:22.402Z'
updated: '2026-03-31T21:21:03.751Z'
sortIndex: 335
---
After an agent creates a PR, automatically assign the reviewer agent (e.g. Deckard Cain / zoidberg) to review the diff. The reviewer agent should: 1) Read the PR diff via gh pr diff, 2) Analyze for bugs, security issues, logic errors, 3) Post review comments via gh pr review, 4) Approve or request changes. Wire into the post-PR flow in agent-worker after createPR. Only review agent-created PRs, not human PRs.

---
**[2026-03-31 21:21:03]** 📋 Leela broke this task into 3 sub-tasks:

- **Add diffPR/reviewPR to GitHubService + create CodeReviewService** → Bender (Backend Dev)
- **Wire CodeReviewService into agent-worker post-PR flow** → Bender (Backend Dev)
- **Write tests for code review flow** → Zoidberg (Tester)
**Feature Branch:** `feature/task-l8ICv8lq`


**[2026-03-31 21:21:03]** 🔀 Task delegated — waiting for subtask completion.
