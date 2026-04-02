---
id: task-5Jd7pfNu
title: Cap state growth and fix reconnect backoff in React hooks
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-_PGGGZ1K'
created: '2026-04-02T02:04:03.908Z'
updated: '2026-04-02T02:20:13.004Z'
sortIndex: 597
parent: task-_PGGGZ1K
---
Fix three frontend hooks:

1. **`use-chat.ts` (`useChatMessages`)** — Add a `MAX_CACHED_MESSAGES` constant (~500). When appending a new message and the array exceeds the cap, evict the oldest messages (slice from the end of the array keeping the newest 500). Ensure the eviction preserves message ordering.

2. **`use-task-events.ts` (`useTaskEvents`)** — Apply the same bounded-array pattern with a `MAX_CACHED_EVENTS` constant (~500). Evict oldest events when the cap is exceeded.

3. **`use-websocket.ts`** — Fix the reconnect backoff bug: currently the exponential delay resets only in `onopen`, but if `onopen` never fires before a `close` event, the delay stays stuck at 30s. Move the delay reset so it triggers on a successful subscribe acknowledgment (e.g., when the first message is received after reconnect, or when the socket confirms subscription), not solely on `onopen`.

Keep constants exported so tests can reference them. Add inline comments only where the eviction logic or reset trigger is non-obvious.

---
**[2026-04-02 02:04:04]** 🚀 Fry started working on this task.
**[2026-04-02 02:04:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:20:13]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
