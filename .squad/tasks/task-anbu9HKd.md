---
id: task-anbu9HKd
title: Add TanStack Table pagination to frontend list pages
status: pending
priority: P0
assignee: fry
labels:
  - 'parent:task-Tf8qZCMT'
created: '2026-04-02T01:26:47.553Z'
updated: '2026-04-02T01:41:56.352Z'
sortIndex: 575
parent: task-Tf8qZCMT
dependsOn:
  - task-cHziworh
description: >
  Install `@tanstack/react-table` in apps/web. Then add server-side pagination
  to all 3 list pages:


  1. **TraceList** (`apps/web/src/components/traces/trace-list.tsx`) — replace
  the `filtered.map()` at line ~354 with a TanStack Table instance. Add
  pagination controls (prev/next, page size selector 50/100). Update
  `useTraces()` hook in `use-traces.ts` to accept `{ limit, offset }` and pass
  to API.

  2. **TaskListView** (`apps/web/src/components/tasks/task-list-view.tsx`) —
  replace `filteredAndSorted.map()` at line ~205 with TanStack Table. Add
  pagination controls. Update `useTasks()` hook similarly.

  3. **Workflows page** (`apps/web/app/workflows/page.tsx`) — add pagination to
  the grid at line ~172. Since it's a card grid (not table), add simple
  prev/next + page indicator below the grid. Update `useWorkflows()` hook.


  Keep existing client-side filtering/sorting UI but move the heavy lifting to
  server-side pagination. Use React Query's `keepPreviousData` for smooth page
  transitions.



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Install `@tanstack/react-table` in apps/web. Then add server-side pagination to all 3 list pages:

1. **TraceList** (`apps/web/src/components/traces/trace-list.tsx`) — replace the `filtered.map()` at line ~354 with a TanStack Table instance. Add pagination controls (prev/next, page size selector 50/100). Update `useTraces()` hook in `use-traces.ts` to accept `{ limit, offset }` and pass to API.
2. **TaskListView** (`apps/web/src/components/tasks/task-list-view.tsx`) — replace `filteredAndSorted.map()` at line ~205 with TanStack Table. Add pagination controls. Update `useTasks()` hook similarly.
3. **Workflows page** (`apps/web/app/workflows/page.tsx`) — add pagination to the grid at line ~172. Since it's a card grid (not table), add simple prev/next + page indicator below the grid. Update `useWorkflows()` hook.

Keep existing client-side filtering/sorting UI but move the heavy lifting to server-side pagination. Use React Query's `keepPreviousData` for smooth page transitions.
