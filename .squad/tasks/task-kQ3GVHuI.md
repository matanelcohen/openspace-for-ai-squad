---
id: task-kQ3GVHuI
title: Implement paginated hooks and Load More UI with virtualization
status: in-progress
priority: P1
assignee: fry
labels:
  - 'parent:task-PpMs5KiZ'
created: '2026-04-02T02:06:50.658Z'
updated: '2026-04-02T02:06:52.914Z'
sortIndex: 607
parent: task-PpMs5KiZ
dependsOn:
  - task-LQT1TEp0
---
Update the frontend hooks `use-traces.ts`, `use-memories.ts`, and `use-tasks.ts` to use cursor-based pagination — use React Query's `useInfiniteQuery` (or equivalent) with the new `cursor`/`limit` params and `nextCursor` from the API. Add a 'Load More' button to TraceList, MemoryList, and TaskList components that fetches the next page, with loading and end-of-list states. Additionally, add `react-window` virtualization to MemoryList (which currently renders all cards in the DOM) to keep DOM node count low even after loading many pages. Install `react-window` and `@types/react-window` if not already present.
