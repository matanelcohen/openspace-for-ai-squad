---
id: task-unzxwGqF
title: Test ingestion polling cleanup
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-diO4GJe8'
created: '2026-04-02T11:07:33.624Z'
updated: '2026-04-02T11:07:33.628Z'
sortIndex: 81
parent: task-diO4GJe8
dependsOn:
  - task-GObTDCHX
---
After the refactor of `ingestion-status.tsx` is complete, verify the fix: (1) Check that no timer/interval leaks exist by reviewing cleanup in useEffect return. (2) Write or update component tests to cover: unmount during active polling clears all timers, successful ingestion completion stops polling, timeout (120s path) stops polling and updates state correctly, rapid mount/unmount doesn't cause state-update-after-unmount warnings. (3) Run existing test suite to confirm no regressions. Look for test files near `ingestion-status.tsx` or in `e2e/` and `packages/*/src/**/*.test.*`.
