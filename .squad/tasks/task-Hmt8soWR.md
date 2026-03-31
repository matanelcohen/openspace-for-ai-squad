---
id: task-Hmt8soWR
title: Add label filter to toolbar
status: pending
priority: P2
assignee: fry
labels:
  - frontend
  - filters
  - enhancement
  - 'parent:task-J6KnCzbH'
created: '2026-03-31T12:50:28.123Z'
updated: '2026-03-31T12:50:28.123Z'
sortIndex: 323
---
The current TaskFilters interface supports status, assignee, priority, and search — but tasks also have labels (freeform tags). Add a label filter dropdown to TaskFiltersToolbar that collects all unique labels from current tasks and lets users filter by label. Follow the pattern used in skill-filters-toolbar.tsx which already has a tag/label dropdown. Update the applyFilters utility and TaskFilters interface to support the new label field.
