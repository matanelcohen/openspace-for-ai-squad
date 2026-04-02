---
id: task-CmJ2q73l
title: Add WS resilience and retry logic to hooks
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Skcn1CvO'
created: '2026-04-02T00:57:33.310Z'
updated: '2026-04-02T02:09:53.301Z'
sortIndex: 568
parent: task-Skcn1CvO
---
In apps/web/src/hooks/use-chat.ts: add retry: 3, retryDelay with exponential backoff, and staleTime: 30_000 to the useChatMessages useQuery call. In use-voice-session.ts: wrap the api.post('/api/voice/speak') call in a try/catch that surfaces errors (store in a voiceError state), and add retry logic for failed voice requests. In use-chat.ts useSendMessage: detect optimistic update rollback in the onError callback of useMutation and trigger a toast notification (import from the new toast setup — see sibling subtask). Also export a useConnectionStatus() helper from use-websocket.ts that returns { isConnected, isReconnecting } by tracking whether a reconnect attempt is in progress (the reconnect setTimeout is already there, just surface the state).

---
**[2026-04-02 01:42:15]** 🚀 Fry started working on this task.
**[2026-04-02 01:42:15]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:47:08]** 🚀 Fry started working on this task.
**[2026-04-02 01:47:08]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:09:53]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
