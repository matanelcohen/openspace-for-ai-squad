---
id: task-bNXxHBbG
title: Lift filter state to TasksPage for cross-view persistence
status: pending
priority: P0
assignee: fry
labels:
  - refactor
  - tasks
  - filters
  - 'parent:task-29M8jJoQ'
created: '2026-03-31T12:45:01.899Z'
updated: '2026-03-31T12:45:01.899Z'
sortIndex: 316
---
Move TaskFilters state from TaskListView up to TasksPage (apps/web/app/tasks/page.tsx). Pass filters and onFiltersChange as props to both KanbanBoard and TaskListView so filter selections persist when toggling between board/list views. Update TaskListView to accept filters as props instead of managing its own state. Extract the standalone applyFilters() function from task-list-view.tsx into a shared utility (e.g. apps/web/src/lib/task-filters.ts) so both views can reuse it.
