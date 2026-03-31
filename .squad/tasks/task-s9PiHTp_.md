---
id: task-s9PiHTp_
title: Add tests for kanban filter functionality
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - kanban
  - unit-test
  - e2e
  - 'parent:task-69Nk8Boi'
created: '2026-03-31T12:18:21.957Z'
updated: '2026-03-31T12:18:21.957Z'
sortIndex: 314
---
Add unit tests for the new use-task-filters hook (filter by status, assignee, priority, search text, and combinations). Add component tests for the kanban board with filters applied (verify correct tasks appear in correct columns after filtering, column counts are accurate, drag-and-drop still works with filtered views). Add E2E tests in the e2e/ directory that: navigate to /tasks in board view, apply each filter type, verify the board updates correctly, switch to list view and confirm filters persist. Reference existing test patterns in e2e/ and vitest.config.ts.
