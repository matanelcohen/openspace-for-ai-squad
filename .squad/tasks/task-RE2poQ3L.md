---
id: task-RE2poQ3L
title: Wire filter state to kanban board page
status: pending
priority: P1
assignee: fry
labels:
  - frontend
  - kanban
  - filters
  - 'parent:task-J6KnCzbH'
created: '2026-03-31T12:50:27.655Z'
updated: '2026-03-31T12:50:27.655Z'
sortIndex: 320
---
In apps/web/app/tasks/page.tsx, the TaskFilters state and TaskFiltersToolbar are likely only rendered for the list view. Lift filter state so it persists across board/list view toggle, and pass filters + onFiltersChange to the kanban board view. Ensure the TaskFiltersToolbar renders above KanbanBoard when in board view. Reference the existing TaskFilters interface from task-filters-toolbar.tsx and follow the same pattern used in task-list-view.tsx.
