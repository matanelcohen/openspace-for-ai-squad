---
id: task-78IxfQTP
title: Test memoization and staleTime changes
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-qKQAfY5R'
created: '2026-04-02T11:07:10.600Z'
updated: '2026-04-02T11:07:10.612Z'
sortIndex: 79
parent: task-qKQAfY5R
dependsOn:
  - task-afF9EMzq
  - task-Voxr_3uP
---
After the frontend changes land: (1) Run the existing test suite to verify nothing is broken. (2) Write or update tests for websocket-provider.tsx to assert the context value is referentially stable across re-renders (React Testing Library + renderHook). (3) Spot-check 2-3 useQuery hooks to verify staleTime is set and that mounting a component with cached data does NOT trigger an immediate refetch. (4) Run the full lint + type-check + test pipeline.
