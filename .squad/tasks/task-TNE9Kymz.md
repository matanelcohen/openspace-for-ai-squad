---
id: task-TNE9Kymz
title: Test polling cleanup and race conditions
status: blocked
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-ayKtVP2N'
created: '2026-04-02T10:29:00.161Z'
updated: '2026-04-02T11:06:46.156Z'
sortIndex: 17
parent: task-ayKtVP2N
dependsOn:
  - task-BLtdIXVy
---
Write or update tests for the ingestion-status component to verify: (1) only one polling interval is active at a time, (2) polling stops after the timeout duration, (3) all timers are cleaned up on unmount (use jest.useFakeTimers or vitest fake timers to advance time and assert no lingering intervals/timeouts), (4) unmounting mid-poll does not cause 'setState on unmounted component' warnings, (5) error responses stop polling and clean up timers. Use the existing test framework (vitest based on vitest.config.ts in repo root). Run the full test suite after to confirm no regressions.

---
**[2026-04-02 11:04:16]** 🚀 Zoidberg started working on this task.
**[2026-04-02 11:04:16]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:06:46]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
