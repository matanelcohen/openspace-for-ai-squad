---
id: task-ip3UVgFm
title: 'Add timeout, JSON error handling, and AbortController helper to api-client.ts'
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-T4o_NFrB'
created: '2026-04-02T01:29:01.957Z'
updated: '2026-04-02T02:10:08.527Z'
sortIndex: 579
parent: task-T4o_NFrB
---
In apps/web/src/lib/api-client.ts:
1. Add a DEFAULT_TIMEOUT_MS = 15000 constant.
2. In apiClient(), merge an AbortSignal.timeout(DEFAULT_TIMEOUT_MS) with any caller-provided signal using AbortSignal.any(). Pass the combined signal into the fetch options.
3. Wrap `res.json()` (line 40) in a try/catch — on parse failure throw new ApiError(res.status, 'Invalid JSON response').
4. Export a `createCancellableRequest()` helper that returns { signal: AbortSignal, abort: () => void } using AbortController, so components can cancel on unmount.
5. Update the `api` convenience methods (get/post/patch/put/delete) to accept an optional `signal?: AbortSignal` parameter and forward it.
6. Ensure the existing ApiError class is reused — add a new error code or use status 0 for timeout/abort errors if needed.

---
**[2026-04-02 01:47:37]** 🚀 Fry started working on this task.
**[2026-04-02 01:47:37]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:10:08]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
