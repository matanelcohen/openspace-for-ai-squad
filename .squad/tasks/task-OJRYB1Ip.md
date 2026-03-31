---
id: task-OJRYB1Ip
title: Extract reusable task filter hook
status: pending
priority: P0
assignee: fry
labels:
  - frontend
  - refactor
  - kanban
  - 'parent:task-69Nk8Boi'
created: '2026-03-31T12:18:21.760Z'
updated: '2026-03-31T12:18:21.760Z'
sortIndex: 311
---
Extract the TaskFilters type, filter state management, and filter application logic from task-list-view.tsx into a shared hook (e.g., use-task-filters.ts in apps/web/src/hooks/). The hook should manage filter state (status, assignee, priority, search), expose setters, and provide a filterTasks(tasks: Task[]) function that applies all active filters. Refactor task-list-view.tsx to consume this new hook instead of its inline filter logic. Ensure the existing list view behavior is unchanged after refactoring.
