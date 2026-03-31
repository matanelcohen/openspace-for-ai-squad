---
id: task-dqk2axeZ
title: Extract shared applyFilters utility
status: pending
priority: P2
assignee: fry
labels:
  - frontend
  - refactor
  - filters
  - 'parent:task-J6KnCzbH'
created: '2026-03-31T12:50:27.981Z'
updated: '2026-03-31T12:50:27.981Z'
sortIndex: 322
---
The applyFilters() function currently lives inline in task-list-view.tsx. Extract it to a shared utility file (e.g., apps/web/src/lib/task-filter-utils.ts) so both the list view and kanban board can reuse the same filtering logic. Update task-list-view.tsx to import from the new location. This ensures filter behavior is consistent across both views.
