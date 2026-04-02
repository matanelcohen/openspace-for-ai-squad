---
id: task-WE7kQr2j
title: Add tests for escalation error-handling hardening
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-33PkX-Ya'
created: '2026-04-02T01:28:16.722Z'
updated: '2026-04-02T01:41:56.062Z'
sortIndex: 578
parent: task-33PkX-Ya
dependsOn:
  - task-7Zj41Qj5
description: >
  Add/update tests for the hardened escalation components to cover crash and
  error scenarios:


  1. **`__tests__/priority-indicator.test.tsx`**: Add tests for `undefined`,
  `null`, and invalid string values passed as `priority` prop — verify fallback
  badge renders without crashing.


  2. **`__tests__/escalation-status-badge.test.tsx`**: Add tests for
  `undefined`, `null`, and invalid string values passed as `status` prop —
  verify fallback badge renders without crashing.


  3. **`__tests__/bulk-action-toolbar.test.tsx`**: Add test where the mutation
  callback rejects/throws — verify `onClearSelection` is NOT called, comment
  input is NOT cleared, and an error toast is shown.


  4. **`__tests__/escalation-detail-panel.test.tsx`**: Add tests where
  approve/reject/requestChanges mutations fail — verify `setComment('')` is NOT
  called (comment textarea still contains user input).


  All tests are in `apps/web/src/components/escalations/__tests__/`. Run with
  `pnpm vitest`.



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Add/update tests for the hardened escalation components to cover crash and error scenarios:

1. **`__tests__/priority-indicator.test.tsx`**: Add tests for `undefined`, `null`, and invalid string values passed as `priority` prop — verify fallback badge renders without crashing.

2. **`__tests__/escalation-status-badge.test.tsx`**: Add tests for `undefined`, `null`, and invalid string values passed as `status` prop — verify fallback badge renders without crashing.

3. **`__tests__/bulk-action-toolbar.test.tsx`**: Add test where the mutation callback rejects/throws — verify `onClearSelection` is NOT called, comment input is NOT cleared, and an error toast is shown.

4. **`__tests__/escalation-detail-panel.test.tsx`**: Add tests where approve/reject/requestChanges mutations fail — verify `setComment('')` is NOT called (comment textarea still contains user input).

All tests are in `apps/web/src/components/escalations/__tests__/`. Run with `pnpm vitest`.
