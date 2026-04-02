---
id: task-X9sSS2z7
title: Test unhandled rejection fixes
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-XmgGXy1j'
created: '2026-04-02T11:22:26.216Z'
updated: '2026-04-02T11:22:26.220Z'
sortIndex: 111
parent: task-XmgGXy1j
dependsOn:
  - task-clvyk3ng
---
Verify all ~4 setInterval call sites in agent-worker/index.ts and innovation/index.ts now have .catch() wrappers. Write or update unit tests that mock the async functions (scan, cleanup, etc.) to reject, and confirm the rejection is caught and logged rather than becoming an unhandled promise rejection. Run existing tests to ensure no regressions.
