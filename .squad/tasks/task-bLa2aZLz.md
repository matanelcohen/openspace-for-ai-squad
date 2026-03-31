---
id: task-bLa2aZLz
title: Integrate filter toolbar and filtering logic into KanbanBoard
status: pending
priority: P0
assignee: fry
labels:
  - feature
  - tasks
  - kanban
  - filters
  - 'parent:task-29M8jJoQ'
created: '2026-03-31T12:45:01.939Z'
updated: '2026-03-31T12:45:01.939Z'
sortIndex: 317
---
In kanban-board.tsx: (1) Accept filters/onFiltersChange props and render TaskFiltersToolbar above the board. (2) Apply the shared applyFilters() to tasks before grouping by status into columns. (3) For the status filter specifically — when a status is selected, only show that column (hide others) instead of filtering tasks out. (4) Show an empty state message in columns when filters match no tasks (e.g. 'No matching tasks') distinct from the existing drag-drop empty state. (5) Display an active filter indicator/count badge and a 'Clear filters' button when any filter is active.
