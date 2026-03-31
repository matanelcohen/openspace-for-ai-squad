---
id: task-OOSpA7DP
title: Add unit and E2E tests for kanban filters
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - e2e
  - unit-tests
  - kanban
  - 'parent:task-rPPZVtGR'
created: '2026-03-31T11:36:35.880Z'
updated: '2026-03-31T11:36:35.880Z'
sortIndex: 309
---
Unit tests: Extract shared filter logic into a utility (e.g., packages/shared or a hooks file) and test each predicate (search, status, priority, assignee) independently. E2E tests (Playwright): Navigate to /tasks in board view, apply each filter type, verify correct tasks are shown/hidden in columns, verify column counts update, verify filters persist when toggling to list view and back. Test that drag-and-drop still works after filtering.
