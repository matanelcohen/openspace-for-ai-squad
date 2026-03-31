---
id: task-nUd8oiI7
title: Add unit and E2E tests for kanban filters
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - tasks
  - kanban
  - filters
  - 'parent:task-29M8jJoQ'
created: '2026-03-31T12:45:01.986Z'
updated: '2026-03-31T12:45:01.986Z'
sortIndex: 318
---
Unit tests: (1) Test the shared applyFilters utility with all filter combinations (status, priority, assignee, search, compound). (2) Test that KanbanBoard correctly groups filtered tasks into columns. E2E tests (Playwright): (1) Verify filter toolbar renders on kanban view. (2) Test filtering by priority — cards not matching should disappear from columns. (3) Test filtering by assignee including 'Unassigned'. (4) Test search filter across title/description/labels. (5) Test status filter shows/hides columns. (6) Test filters persist when switching between board↔list views. (7) Test 'Clear filters' resets all. Reference existing patterns in e2e/ directory.
