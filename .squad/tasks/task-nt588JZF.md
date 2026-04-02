---
id: task-nt588JZF
title: Test refactored filter/sort/status behavior across all pages
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-5__3unpm'
created: '2026-04-02T02:19:50.522Z'
updated: '2026-04-02T02:19:50.698Z'
sortIndex: 641
parent: task-5__3unpm
dependsOn:
  - task-PbgIbkoP
---
Write or update tests for the new useFilteredData<T>() hook covering: filtering by each status value, text search with partial matches, sort ascending/descending by different fields, edge cases (empty data, no matches, special characters in search). Also run existing E2E/integration tests for trace-list, team-members, and workflows pages to confirm no regressions. Verify STATUS_CONFIG constants render correct badge colors and labels in trace-list and trace-detail views.
