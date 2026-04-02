---
id: task-OGCCfn6J
title: Test error handling for mutations and JSON.parse guard
status: blocked
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-l1AZ5YVT'
created: '2026-04-02T10:16:30.060Z'
updated: '2026-04-02T11:02:25.855Z'
sortIndex: 10
parent: task-l1AZ5YVT
dependsOn:
  - task-r65ExWrw
  - task-I7U80mhX
---
Write tests covering all three fixes:

1. **bulk-action-toolbar.tsx:** Test that when `mutateAsync` rejects (mock it to throw), a toast/error notification is shown and no unhandled promise rejection occurs. Test that successful mutations show a success toast.

2. **escalations.ts JSON.parse:** Test the API route with malformed/invalid JSON in the workflow state field. Verify it returns a 500 status with the expected error body instead of crashing. Also test that valid JSON still works correctly (regression test).

3. **tasks/page.tsx:** Test that the error state renders correctly when data fetching fails (mock the fetch to reject). Test that the loading state renders during fetch. Test that a retry mechanism works if one was added.

Use the existing test framework in the project (vitest based on vitest.config.ts in the repo root, and playwright for e2e based on playwright.config.ts).

---
**[2026-04-02 10:54:12]** 🚀 Zoidberg started working on this task.
**[2026-04-02 10:54:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:02:25]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
