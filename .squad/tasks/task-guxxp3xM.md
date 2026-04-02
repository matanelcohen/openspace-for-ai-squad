---
id: task-guxxp3xM
title: Test error boundaries on all major pages
status: blocked
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-u42u1F_O'
created: '2026-04-01T22:58:43.174Z'
updated: '2026-04-02T00:34:20.074Z'
sortIndex: 387
parent: task-u42u1F_O
dependsOn:
  - task-g1QNaIHn
---
Write tests verifying the ErrorBoundary behavior:
1. Unit test the ErrorBoundary component: render a child that throws, confirm fallback UI appears, click Retry, confirm reset works
2. For each of the 5 pages (Escalations, Workflows, Tasks, Team Members, Terminal), write a test that simulates a child component error and verifies the error boundary catches it and shows the fallback rather than crashing the page
3. Test the Terminal page's dynamic import: verify the loading state renders during lazy load and the error boundary catches import failures
4. Use vitest + React Testing Library (already in the repo). Check existing test patterns under apps/web/src for conventions.

---
**[2026-04-01 23:31:52]** 🚀 Zoidberg started working on this task.
**[2026-04-01 23:31:52]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-01 23:32:01]** 🚀 Zoidberg started working on this task.
**[2026-04-01 23:32:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-01 23:33:08]** 🚀 Zoidberg started working on this task.

---
**[2026-04-01 23:33:08]** ❌ **BLOCKED** — zoidberg failed.

**Error:** fetchTask task-guxxp3xM failed (404): {"error":"Task not found: task-guxxp3xM"}

**Stack:** ```
Error: fetchTask task-guxxp3xM failed (404): {"error":"Task not found: task-guxxp3xM"}
    at AgentWorkerService.fetchTask (/private/tmp/openspace-task-W46ss1fx--81793-Uh2lhBWNyQdv/apps/api/src/services/agent-worker/index.ts:164:13)
    at processTicksAndRejections (node:internal/process/task_queues:105:5)
    at AgentWorkerService.processNext (/private/tmp/openspace-task-W46ss1fx--81793-Uh2lhBWNyQdv/apps/api/src/services/agent-worker/index.ts:651:20)
```

---
**[2026-04-02 00:34:20]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Task timed out after 30 minutes

**Stack:** ```
Error: Task timed out after 30 minutes
    at Timeout._onTimeout (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:1019:35)
    at listOnTimeout (node:internal/timers:588:17)
    at process.processTimers (node:internal/timers:523:7)
```
