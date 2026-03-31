---
id: task-az6RnYEC
title: Apply filter logic inside kanban-board component
status: pending
priority: P1
assignee: fry
labels:
  - frontend
  - kanban
  - filters
  - 'parent:task-J6KnCzbH'
created: '2026-03-31T12:50:27.801Z'
updated: '2026-03-31T12:50:27.801Z'
sortIndex: 321
---
In apps/web/src/components/tasks/kanban-board.tsx, accept a TaskFilters prop and apply client-side filtering to tasks before grouping them into status columns. Reuse or extract the applyFilters() function from task-list-view.tsx into a shared utility (e.g., src/lib/task-filter-utils.ts). For the status filter specifically: when a status is selected, only show that column (or highlight it) since kanban columns map directly to statuses. Handle empty filtered columns gracefully with an empty state message like 'No tasks match filters'.
