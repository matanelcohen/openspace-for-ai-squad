---
id: task-zTzB7Z77
title: 'Add timeouts, JSON error handling, and AbortController to API client'
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-T4o_NFrB'
created: '2026-04-02T00:00:55.766Z'
updated: '2026-04-02T00:34:31.053Z'
sortIndex: 482
parent: task-T4o_NFrB
---
In `api-client.ts` (lines 23-41):
1. Add `AbortSignal.timeout(15000)` as the default signal on all fetch calls so requests don't hang indefinitely.
2. Wrap `res.json()` in a try/catch — on parse failure, throw a typed `ApiError` with the status code, raw response text, and a clear message like 'Failed to parse JSON response'.
3. Define and export an `ApiError` class (or extend Error) with fields: `status`, `message`, `rawBody`.
4. Export a `createCancellableRequest()` helper that returns `{ signal, cancel }` using `AbortController`, so components can abort in-flight requests on unmount.
5. Ensure the default timeout signal and any user-provided signal are combined (use `AbortSignal.any()` if available, or fallback to manual linking).
6. Make sure existing call sites still work — the timeout/abort should be opt-out, not breaking.
meout/abort should be
  opt-out, not breaking.



  ---

  **[2026-04-02 00:14:20]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
In `api-client.ts` (lines 23-41):
1. Add `AbortSignal.timeout(15000)` as the default signal on all fetch calls so requests don't hang indefinitely.
2. Wrap `res.json()` in a try/catch — on parse failure, throw a typed `ApiError` with the status code, raw response text, and a clear message like 'Failed to parse JSON response'.
3. Define and export an `ApiError` class (or extend Error) with fields: `status`, `message`, `rawBody`.
4. Export a `createCancellableRequest()` helper that returns `{ signal, cancel }` using `AbortController`, so components can abort in-flight requests on unmount.
5. Ensure the default timeout signal and any user-provided signal are combined (use `AbortSignal.any()` if available, or fallback to manual linking).
6. Make sure existing call sites still work — the timeout/abort should be opt-out, not breaking.

---
**[2026-04-02 00:16:37]** 🚀 Fry started working on this task.
**[2026-04-02 00:16:37]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:16:43]** 🚀 Fry started working on this task.
**[2026-04-02 00:16:43]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:18:38]** 🚀 Fry started working on this task.
**[2026-04-02 00:18:38]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:19:01]** 🚀 Fry started working on this task.
**[2026-04-02 00:19:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:42]** 🚀 Fry started working on this task.
**[2026-04-02 00:33:42]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:09]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:09]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:28]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:28]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:31]** ❌ **BLOCKED** — fry failed.

**Error:** patchTask task-zTzB7Z77 failed (500): {"error":"Missing required field \"id\" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-zTzB7Z77.md"}

**Stack:** ```
Error: patchTask task-zTzB7Z77 failed (500): {"error":"Missing required field \"id\" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-zTzB7Z77.md"}
    at AgentWorkerService.patchTask (/private/tmp/openspace-task-W46ss1fx--81793-Uh2lhBWNyQdv/apps/api/src/services/agent-worker/index.ts:178:13)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at AgentWorkerService.processNext (/private/tmp/openspace-task-W46ss1fx--81793-Uh2lhBWNyQdv/apps/api/src
```
