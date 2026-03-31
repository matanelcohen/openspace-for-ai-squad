---
id: task-HB74L76L
title: Extract shared task filtering utility
status: pending
priority: P1
assignee: bender
labels:
  - refactor
  - shared-utils
  - tasks
  - 'parent:task-XGIIS5pk'
created: '2026-03-31T13:01:34.265Z'
updated: '2026-03-31T13:01:34.265Z'
sortIndex: 326
---
The `applyFilters` function currently lives inline in `task-list-view.tsx` (lines 36-53). Extract it into a shared utility (e.g., `packages/shared/src/utils/task-filters.ts` or `apps/web/src/lib/task-filters.ts`) so both the list view and kanban board can reuse the same filtering logic. Export the `TaskFilters` type from a shared location as well. Update `task-list-view.tsx` to import from the new shared location.
