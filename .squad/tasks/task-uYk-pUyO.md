---
id: task-uYk-pUyO
title: Test skills page deduplication
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-hSFh1VSv'
created: '2026-04-02T02:15:00.108Z'
updated: '2026-04-02T02:15:00.112Z'
sortIndex: 624
parent: task-hSFh1VSv
dependsOn:
  - task-VJH9--3T
---
Verify the refactored skills page: (1) only one /api/skills network request fires on page load (check Network tab or mock), (2) filtering still works correctly — filtered results match what the server would return, (3) installedIds are correctly computed, (4) no regressions in skills display, install/uninstall actions. Run existing tests and add a test confirming a single fetch occurs.
