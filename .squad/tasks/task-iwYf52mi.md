---
id: task-iwYf52mi
title: Test error notifications on destructive actions
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-iHAm-i0f'
created: '2026-04-02T11:15:23.579Z'
updated: '2026-04-02T11:15:23.582Z'
sortIndex: 106
parent: task-iHAm-i0f
dependsOn:
  - task-St0KP6qb
---
After the toast system is wired in, write Playwright or Vitest tests verifying that: (1) when `api.delete('/api/traces')` fails (mock a 500), a toast error is shown to the user and the loading spinner stops, (2) when knowledge ingest fails, a toast error appears, (3) when workflow save fails, a toast error appears. Also verify the happy path still works — successful actions should NOT show error toasts. Check that retry buttons in toasts re-trigger the action. Run the existing test suite to confirm no regressions.
