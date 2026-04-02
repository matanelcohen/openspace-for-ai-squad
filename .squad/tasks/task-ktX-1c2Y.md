---
id: task-ktX-1c2Y
title: Verify timer cleanup and scroll debounce
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Fr2ZPdsW'
created: '2026-04-02T11:05:38.487Z'
updated: '2026-04-02T11:05:38.489Z'
sortIndex: 66
parent: task-Fr2ZPdsW
dependsOn:
  - task-pjkgYSs7
---
After the frontend fixes are applied, verify each of the 4 pages:

1. **workflows/compose/page.tsx**: Confirm the `setTimeout` ref is cleared on unmount — navigate away before the 1s delay fires and verify no React state-update-on-unmounted-component warning in console.
2. **team-members/[id]/page.tsx**: Trigger save, then navigate away before success timeout fires — verify no warning.
3. **tasks/[id]/page.tsx**: Rapidly add multiple events and confirm `scrollIntoView` is debounced (not called on every single change) — verify cleanup on unmount.
4. **cron/page.tsx**: Start a cron job, navigate away quickly — verify no state race or unmounted-component warning.

Run the existing test suite (`pnpm test`) to ensure no regressions. Check that `useRef` and `useEffect` cleanup patterns are consistently applied across all 4 files.
