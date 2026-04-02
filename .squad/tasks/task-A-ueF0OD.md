---
id: task-A-ueF0OD
title: Test live timer behavior
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-vT8YwDLA'
created: '2026-04-02T02:16:14.437Z'
updated: '2026-04-02T02:16:14.439Z'
sortIndex: 630
parent: task-vT8YwDLA
dependsOn:
  - task-jqmTK373
---
After the hook is implemented, verify the fix:
1. Write a unit test for `useLiveTimer` (using `@testing-library/react` + `vi.useFakeTimers`) confirming: (a) returned `now` updates every second, (b) interval is cleared on unmount (no memory leak).
2. Write or update a component test for the dashboard page confirming the 'Last scan: Xs ago' and 'Next in: Xs' text actually changes after 1 second of fake-timer advancement.
3. Run the existing test suite (`pnpm test`) to ensure no regressions.
