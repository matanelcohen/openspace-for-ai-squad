---
id: task-FFwWA83J
title: Build team status aggregator and system prompt injection
status: blocked
priority: P1
assignee: leela
labels:
  - 'parent:task-BFFSkKUv'
created: '2026-03-31T21:35:47.311Z'
updated: '2026-03-31T22:35:30.681Z'
sortIndex: 348
parent: task-BFFSkKUv
---
Create a TeamStatusService that aggregates what each agent is currently doing by pulling from agentWorker.getStatus() and recent WebSocket events. It should return a formatted markdown block like:

## Team Status
- Fry is working on Add login page (branch: task/task-abc, 60% done)
- Bender is working on API auth routes (branch: task/task-def, just started)

Then integrate this into the agent worker pipeline: before an agent starts a task, call TeamStatusService.getFormattedStatus(excludeAgentId) (excluding the current agent) and inject the result into the agent's system prompt. Key details:
1. Look at the existing agentWorker.getStatus() return shape and WebSocket event types to understand what data is available (agent name, task title, branch, progress)
2. Create packages/shared/src/services/team-status.ts (or similar) with a TeamStatusService class
3. Wire it into the agent worker's task startup flow in the system prompt construction
4. Handle edge cases: no other agents active (skip injection), stale status (ignore agents idle >30min)
5. Make sure the status section is concise — it goes into context window so keep it tight

---
**[2026-03-31 22:18:51]** 📋 Leela broke this task into 2 sub-tasks:

- **Create TeamStatusService and wire into agent worker** → Bender (Backend Dev)
- **Test TeamStatusService and system prompt integration** → Zoidberg (Tester)
**Feature Branch:** `feature/task-FFwWA83J`


**[2026-03-31 22:18:51]** 🔀 Task delegated — waiting for subtask completion.

---
**[2026-03-31 22:35:27]** 🚀 Bender started working on this task.
**[2026-03-31 22:35:27]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:35:30]** ❌ **BLOCKED** — bender failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-FFwWA83J' -b 'task/task-FFwWA83J' 'feature/task-BFFSkKUv'
Preparing worktree (new branch 'task/task-FFwWA83J')
fatal: a branch named 'task/task-FFwWA83J' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-FFwWA83J' -b 'task/task-FFwWA83J' 'feature/task-BFFSkKUv'
Preparing worktree (new branch 'task/task-FFwWA83J')
fatal: a branch named 'task/task-FFwWA83J' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```
