---
id: task-F0p5jX9Z
title: Test paginated tasks and escalations hooks
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-8-x_Q46m'
created: '2026-04-02T11:08:42.023Z'
updated: '2026-04-02T11:08:42.031Z'
sortIndex: 86
parent: task-8-x_Q46m
dependsOn:
  - task-1G66DogN
---
Write tests verifying: (1) useTasks and useEscalations fetch only 50 records on initial load, (2) calling `fetchNextPage` retrieves the next batch, (3) the hooks correctly report `hasNextPage` state, (4) edge cases — empty results, single page of results, exact multiple of page size. Use the existing test patterns in the repo (Vitest + React Testing Library). Also verify the backend routes return correct pagination metadata with limit/offset params.
