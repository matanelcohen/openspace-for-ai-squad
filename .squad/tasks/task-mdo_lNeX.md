---
id: task-mdo_lNeX
title: Test SlaCountdown hydration fix
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-0e-6Ihf3'
created: '2026-04-02T11:22:56.773Z'
updated: '2026-04-02T11:22:56.776Z'
sortIndex: 115
parent: task-0e-6Ihf3
dependsOn:
  - task-gpy1iSLd
---
Verify the fix: (1) Confirm no React hydration mismatch warnings in the browser console during SSR page load. (2) Confirm the countdown renders '—' briefly then shows the correct remaining time with no flicker. (3) Test that changing the `timeoutAt` prop resets the countdown interval correctly. (4) Test edge cases: expired timeout (timeoutAt in the past), null/undefined timeoutAt, timeoutAt far in the future. (5) Run existing tests with `pnpm test` to ensure no regressions.
