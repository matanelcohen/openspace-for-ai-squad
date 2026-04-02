---
id: task-v4PjbjY0
title: Cap message cache and add virtual scrolling
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-DzQjhtJd'
created: '2026-04-02T02:17:39.787Z'
updated: '2026-04-02T02:57:04.327Z'
sortIndex: 633
parent: task-DzQjhtJd
---
In apps/web, locate the use-chat.ts hook (or similar) where WebSocket messages are appended to the react-query cache via setQueryData. Add a MAX_CACHED_MESSAGES constant (500) and slice the array in the setQueryData callback so only the most recent 500 messages are kept. Also fix the O(n log n) sort — if messages arrive in order, use insertion or skip the sort. Then implement virtual scrolling (e.g. @tanstack/react-virtual or similar) on the message list component so the DOM only renders visible messages. Ensure scrolling to bottom on new messages still works, and that users can scroll up to load older messages via pagination (trigger a fetch for the previous page when the user scrolls near the top).

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:57:04]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
