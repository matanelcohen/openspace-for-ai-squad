---
id: task-HlvzyYmJ
title: Add unit and integration tests for kanban filters
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - unit-test
  - integration-test
  - kanban
  - 'parent:task-XGIIS5pk'
created: '2026-03-31T13:01:34.395Z'
updated: '2026-03-31T13:01:34.395Z'
sortIndex: 329
---
Add tests in `apps/web/src/components/tasks/__tests__/` covering: (1) The extracted `applyFilters` utility — unit tests for each filter dimension (status, priority, assignee, search) and combinations. (2) Integration test for `KanbanBoard` with filters — verify that selecting a filter updates visible cards, that clearing filters restores all cards, and that drag-and-drop still works on filtered results. Use the existing test patterns in the `__tests__/` directory.
