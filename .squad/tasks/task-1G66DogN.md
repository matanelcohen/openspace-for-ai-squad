---
id: task-1G66DogN
title: Refactor useTasks and useEscalations hooks to useInfiniteQuery
status: pending
priority: P1
assignee: fry
labels:
  - 'parent:task-8-x_Q46m'
created: '2026-04-02T11:08:41.992Z'
updated: '2026-04-02T11:08:42.029Z'
sortIndex: 85
parent: task-8-x_Q46m
dependsOn:
  - task-YdB0GbPO
---
In apps/web, refactor `use-tasks.ts` and `use-escalations.ts` to replace `useQuery()` with `useInfiniteQuery()` from TanStack Query, fetching 50 records per page. Follow the existing pattern from the chat hooks (look for useInfiniteQuery usage in the chat feature). Wire up `getNextPageParam` using the `hasMore`/`nextCursor` from the updated API response. Flatten pages in the hook return so consumers still get a simple array. Update any components that call these hooks if the return shape changes (e.g., `data.pages.flatMap`).
