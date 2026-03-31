---
id: task-jHy7slPw
title: Integrate filter toolbar into kanban board
status: pending
priority: P0
assignee: fry
labels:
  - frontend
  - kanban
  - feature
  - 'parent:task-69Nk8Boi'
created: '2026-03-31T12:18:21.804Z'
updated: '2026-03-31T12:18:21.804Z'
sortIndex: 312
---
Add the TaskFiltersToolbar component to kanban-board.tsx, wired to the new use-task-filters hook. Apply the filter function to tasks before grouping them by status into columns. For the status filter: either hide the status dropdown in board mode (since columns represent statuses) or use it to show/hide entire columns. Ensure filtered-out tasks don't appear in any column, and column task counts update to reflect filtered results. Keep drag-and-drop working correctly with filtered tasks. The toolbar should sit above the kanban columns in the same layout pattern as the list view.
