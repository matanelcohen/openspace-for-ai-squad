---
id: task-BFFSkKUv
title: Shared agent context — agents see what others are working on
status: delegated
priority: P1
assignee: leela
labels: []
created: '2026-03-31T21:12:13.994Z'
updated: '2026-03-31T21:35:47.683Z'
sortIndex: 338
---
When an agent starts a task, inject a "Team Status" section into its system prompt showing what other agents are currently doing: their active task title, branch, and progress summary. This prevents duplicate work and enables coordination. Pull from agentWorker.getStatus() and recent WebSocket events. Example: "## Team Status
- Fry is working on Add login page (branch: task/task-abc, 60% done)
- Bender is working on API auth routes (branch: task/task-def, just started)"

---
**[2026-03-31 21:35:47]** 📋 Leela broke this task into 2 sub-tasks:

- **Build team status aggregator and system prompt injection** → Bender (Backend Dev)
- **Test team status injection end-to-end** → Zoidberg (Tester)
**Feature Branch:** `feature/task-BFFSkKUv`


**[2026-03-31 21:35:47]** 🔀 Task delegated — waiting for subtask completion.
