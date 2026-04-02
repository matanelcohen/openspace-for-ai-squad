---
id: task-St0KP6qb
title: Add toast system and wire error handling into destructive actions
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-iHAm-i0f'
created: '2026-04-02T11:15:23.349Z'
updated: '2026-04-02T11:17:20.012Z'
sortIndex: 105
parent: task-iHAm-i0f
---
Install `sonner` (lightweight, unstyled-friendly toast library) and add a <Toaster /> provider at the app layout level. Then find all destructive/async action handlers that silently swallow errors — specifically: (1) `traces/page.tsx` handleClearAll try/finally with no catch, (2) knowledge ingest handlers, (3) workflow save handlers. For each, add a catch block that calls `toast.error(message)` with a user-friendly error message. Include a 'Retry' action in the toast where idempotent retry is safe (e.g., clear traces, save workflow). Ensure the button/spinner loading state is properly reset in both success and error paths. Use `sonner` toast API: `toast.error('Failed to clear traces', { action: { label: 'Retry', onClick: () => handleClearAll() } })`.

---
**[2026-04-02 11:17:13]** 🚀 Fry started working on this task.
**[2026-04-02 11:17:13]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:17:19]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
