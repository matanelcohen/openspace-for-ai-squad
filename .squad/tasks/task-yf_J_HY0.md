---
id: task-yf_J_HY0
title: Add error-handling tests for escalation mutations
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-3_9_UMsP'
created: '2026-04-02T01:57:03.607Z'
updated: '2026-04-02T01:57:03.611Z'
sortIndex: 586
parent: task-3_9_UMsP
dependsOn:
  - task-2Qo0FZTo
---
Add test cases to both existing test files: 1. In __tests__/bulk-action-toolbar.test.tsx: add tests for (a) mutateAsync rejecting shows error text/toast, (b) onClearSelection is NOT called on failure, (c) success path shows success toast. Mock toast from 'sonner' (vi.mock('sonner')). 2. In __tests__/escalation-detail-panel.test.tsx: add tests for (a) claim mutation error shows error feedback, (b) approve/reject/requestChanges error shows error feedback, (c) comment is NOT cleared on error. The detail panel uses .mutate() not .mutateAsync(), so test using the onError callback or by checking isError state — verify how fry implemented it and test accordingly. Mock sonner toast. Run all escalation tests with `pnpm vitest run apps/web/src/components/escalations` and ensure they pass.
