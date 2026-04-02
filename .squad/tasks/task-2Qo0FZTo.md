---
id: task-2Qo0FZTo
title: Add toast infrastructure and fix escalation error handling
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-3_9_UMsP'
created: '2026-04-02T01:57:02.897Z'
updated: '2026-04-02T02:11:34.728Z'
sortIndex: 585
parent: task-3_9_UMsP
---
1. Install `sonner` toast library in apps/web. 2. Add <Toaster /> to the root layout (apps/web/src/app/layout.tsx or equivalent). 3. In bulk-action-toolbar.tsx: wrap the mutateAsync calls in handleConfirm with try-catch, show toast.error on failure with the error message, show toast.success on success (e.g. 'Approved 3 escalations'), and do NOT call onClearSelection/reset state on error. 4. In escalation-detail-panel.tsx: convert handleClaim/handleApprove/handleReject/handleRequestChanges to async functions with try-catch, show toast.error on failure, show toast.success on success, only clear the comment on success. Import toast from 'sonner' in both files. Make sure existing tests still pass after changes.

---
**[2026-04-02 01:57:04]** 🚀 Fry started working on this task.
**[2026-04-02 01:57:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:11:34]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
