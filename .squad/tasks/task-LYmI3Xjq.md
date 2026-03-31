---
id: task-LYmI3Xjq
title: Persist filter state across view toggles
status: pending
priority: P1
assignee: fry
labels:
  - frontend
  - ux
  - kanban
  - 'parent:task-69Nk8Boi'
created: '2026-03-31T12:18:21.907Z'
updated: '2026-03-31T12:18:21.907Z'
sortIndex: 313
---
When switching between board and list views on /tasks page, filters should persist. Lift filter state to the parent page.tsx using the shared use-task-filters hook, and pass filters down to both KanbanBoard and TaskListView. Alternatively, use URL search params (e.g., ?priority=P0&assignee=bender) so filters survive page refreshes too. Ensure the filter toolbar shows the same active filters regardless of which view is displayed.
