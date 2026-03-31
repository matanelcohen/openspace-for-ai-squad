---
id: task-JxHOQ-s5
title: Persist filter state across board/list view toggle
status: pending
priority: P1
assignee: fry
labels:
  - frontend
  - state-management
  - UX
  - 'parent:task-rPPZVtGR'
created: '2026-03-31T11:36:35.836Z'
updated: '2026-03-31T11:36:35.836Z'
sortIndex: 308
---
When users switch between Board and List views on the tasks page (app/tasks/page.tsx), filter selections should persist. Use either URL search params (nuqs or manual) or lift filter state to the parent TasksPage component so both KanbanBoard and TaskListView share the same filter values. URL params are preferred for shareability and back-button support.
