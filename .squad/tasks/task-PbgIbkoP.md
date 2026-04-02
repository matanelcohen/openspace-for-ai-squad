---
id: task-PbgIbkoP
title: Refactor all consuming pages to use shared hook and constants
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-5__3unpm'
created: '2026-04-02T02:19:50.479Z'
updated: '2026-04-02T02:19:50.610Z'
sortIndex: 640
parent: task-5__3unpm
dependsOn:
  - task-uHq2lwwx
---
Replace the inline filter/sort/status logic in trace-list.tsx, team-members/page.tsx, workflows/page.tsx, and any other identified pages with the new useFilteredData<T>() hook and shared STATUS_CONFIG constants. Remove the ~200 lines of duplicated code. Verify each page renders identically to before the refactor by checking filter dropdowns, search inputs, sort controls, and status badges all still work correctly.
