---
id: task-WgAilE0Q
title: Test error boundaries and crash guards
status: blocked
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-UWxq8nPT'
created: '2026-04-01T23:08:15.254Z'
updated: '2026-04-02T00:19:26.284Z'
sortIndex: 399
parent: task-UWxq8nPT
dependsOn:
  - task-bFesASw3
---
After the frontend fixes land, verify all three categories of changes:

1. **Config fallback tests**: Write unit tests for `priority-indicator.tsx` and `escalation-status-badge.tsx` that pass unknown/undefined enum values and assert the component renders a fallback instead of throwing.

2. **Error boundary tests**: For each new `error.tsx` file, write a test that simulates a child component throwing and asserts the error boundary renders the fallback UI with a 'Try again' button.

3. **Toast notification tests**: For the pages where silent catches were replaced (`skills/gallery`, `tasks/[id]`, `settings`), write tests that mock a failing API call and assert a toast notification appears with an appropriate error message.

Use the project's existing test framework (vitest + React Testing Library). Run the full test suite to confirm no regressions.

---
**[2026-04-01 23:36:11]** 🚀 Zoidberg started working on this task.
**[2026-04-01 23:36:11]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:19:26]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Task timed out after 15 minutes

**Stack:** ```
Error: Task timed out after 15 minutes
    at Timeout._onTimeout (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:1019:35)
    at listOnTimeout (node:internal/timers:588:17)
    at process.processTimers (node:internal/timers:523:7)
```
