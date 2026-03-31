---
id: task-_SK-d_8M
title: Integrate filters toolbar into kanban board
status: pending
priority: P0
assignee: fry
labels:
  - feature
  - kanban
  - filters
  - ui
  - 'parent:task-XGIIS5pk'
created: '2026-03-31T13:01:34.321Z'
updated: '2026-03-31T13:01:34.321Z'
sortIndex: 327
---
Wire up `TaskFiltersToolbar` into the kanban board view. In `kanban-board.tsx` (or its parent page component), add filter state (`useState<TaskFilters>`), render the `TaskFiltersToolbar` above the board columns, and apply the shared `applyFilters()` to the tasks before grouping them by status into columns. Ensure filtered-out tasks don't appear in any column and that column task counts reflect the filtered set. Preserve drag-and-drop functionality on filtered results.
