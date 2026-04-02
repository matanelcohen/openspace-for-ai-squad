---
id: task-SYwn8B4r
title: Implement paginated UI with server-side filtering
status: in-progress
priority: P1
assignee: fry
labels:
  - 'parent:task-o8sVmRr2'
created: '2026-04-02T02:14:12.788Z'
updated: '2026-04-02T02:14:12.847Z'
sortIndex: 617
parent: task-o8sVmRr2
dependsOn:
  - task-ALCLKni_
---
Refactor frontend list pages and their data-fetching hooks to pass filter/search/pagination params to the API instead of fetching all items and filtering client-side. Remove the in-memory .filter() logic (e.g., team-members/page.tsx:51-65). Update hooks (e.g., use-team-members.ts) to accept filter/page params and pass them as query strings. Add infinite-scroll or a 'Load More' button to list views using the hasMore flag from the API response. Add debounced search input. Files: apps/web/app/team-members/page.tsx, apps/web/src/hooks/use-team-members.ts, and equivalent for skills/tasks.
