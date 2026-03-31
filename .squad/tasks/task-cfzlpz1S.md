---
id: task-cfzlpz1S
title: Integrate filter toolbar into kanban board UI
status: pending
priority: P0
assignee: fry
labels:
  - frontend
  - kanban
  - filters
  - 'parent:task-rPPZVtGR'
created: '2026-03-31T11:36:35.708Z'
updated: '2026-03-31T11:36:35.708Z'
sortIndex: 306
---
Add the existing TaskFiltersToolbar component to the KanbanBoard view. Place it above the columns in kanban-board.tsx. Manage filter state (search, status, priority, assignee) using useState or URL search params. The toolbar component already exists in task-filters-toolbar.tsx — reuse it directly. Ensure the toolbar renders consistently between board and list views for a unified UX.
