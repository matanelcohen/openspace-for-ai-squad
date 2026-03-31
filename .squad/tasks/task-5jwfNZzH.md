---
id: task-5jwfNZzH
title: Test kanban filters end-to-end
status: pending
priority: P2
assignee: zoidberg
labels:
  - testing
  - kanban
  - filters
  - 'parent:task-J6KnCzbH'
created: '2026-03-31T12:50:28.266Z'
updated: '2026-03-31T12:50:28.266Z'
sortIndex: 324
---
Write E2E tests (Playwright) or unit tests (Vitest) verifying: (1) filter toolbar appears in kanban view, (2) selecting a priority filter hides non-matching cards, (3) selecting a status filter shows only that column, (4) assignee filter works correctly, (5) search filters cards by title/description/labels, (6) filters persist when toggling between board and list views, (7) clearing filters restores all tasks. Check existing test patterns in e2e/ and follow conventions.
