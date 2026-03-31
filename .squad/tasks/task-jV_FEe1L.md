---
id: task-jV_FEe1L
title: Implement client-side filtering logic for kanban columns
status: pending
priority: P0
assignee: fry
labels:
  - frontend
  - kanban
  - filters
  - logic
  - 'parent:task-rPPZVtGR'
created: '2026-03-31T11:36:35.770Z'
updated: '2026-03-31T11:36:35.770Z'
sortIndex: 307
---
Apply filter predicates to tasks before distributing them into kanban columns. Reuse the same filtering logic from task-list-view.tsx (lines 36-53): case-insensitive search on title/description/labels, status filter, priority filter, assignee filter. Update column task counts to reflect filtered results. Ensure drag-and-drop still works correctly with filtered task subsets (SortableContext items must match filtered list). Handle edge case where a column becomes empty after filtering — show the existing empty state.
