---
id: task-7Zj41Qj5
title: Harden escalation components with null-guards and error handling
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-33PkX-Ya'
created: '2026-04-02T01:28:16.540Z'
updated: '2026-04-02T02:09:57.294Z'
sortIndex: 577
parent: task-33PkX-Ya
---
Fix 4 issues across escalation components:

1. **PriorityIndicator** (`apps/web/src/components/escalations/priority-indicator.tsx`, line 41): Add null/undefined guard for `priority` prop — return a neutral fallback badge instead of crashing on invalid values.

2. **EscalationStatusBadge** (`apps/web/src/components/escalations/escalation-status-badge.tsx`, line 54): Add null/undefined guard for `status` prop — return a neutral 'Unknown' badge instead of crashing on invalid values.

3. **BulkActionToolbar** (`apps/web/src/components/escalations/bulk-action-toolbar.tsx`, lines 37-47): Wrap `handleConfirm` body in try/catch. Currently `setComment('')` (line 45) and `onClearSelection()` (line 46) run unconditionally after the mutation — move them inside a success path so they don't execute on failure. Add an error toast on catch.

4. **EscalationDetailPanel** (`apps/web/src/components/escalations/escalation-detail-panel.tsx`, lines 53/57/61): The `handleApprove`, `handleReject`, and `handleRequestChanges` functions clear `setComment('')` before the mutation succeeds. Move `setComment('')` into `onSuccess` callbacks so user input is preserved on error.

Existing test files are in `apps/web/src/components/escalations/__tests__/`. Run `pnpm vitest` to verify nothing breaks.

---
**[2026-04-02 01:47:16]** 🚀 Fry started working on this task.
**[2026-04-02 01:47:16]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:09:57]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
