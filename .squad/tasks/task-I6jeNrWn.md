---
id: task-I6jeNrWn
title: Implement infinite scroll in use-chat.ts
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-DMOHDpod'
created: '2026-04-02T10:39:44.269Z'
updated: '2026-04-02T11:04:53.420Z'
sortIndex: 45
parent: task-DMOHDpod
---
Replace the hardcoded `limit=50&offset=0` fetch in `use-chat.ts` with `useInfiniteQuery` (from TanStack Query). Use the existing `ChatMessagesResponse` pagination fields (total, limit, offset) to compute `getNextPageParam`. Add an intersection-observer on a sentinel element at the top of the chat list (or a 'Load earlier messages' button as fallback) that triggers `fetchNextPage`. Prepend older messages to the top of the list while preserving scroll position so the view doesn't jump. Ensure the initial page still loads the latest 50 messages and older pages are fetched on demand.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:04:53]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
