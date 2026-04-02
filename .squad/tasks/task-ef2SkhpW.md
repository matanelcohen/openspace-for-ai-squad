---
id: task-ef2SkhpW
title: Test filtering and pagination end-to-end
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-o8sVmRr2'
created: '2026-04-02T02:14:12.844Z'
updated: '2026-04-02T02:14:12.849Z'
sortIndex: 618
parent: task-o8sVmRr2
dependsOn:
  - task-SYwn8B4r
---
Write tests covering: (1) API unit/integration tests — verify each filter param (department, status, search) returns correct subsets, pagination returns correct pages, edge cases like page beyond total return empty data. (2) Frontend integration tests — verify search input triggers server request with debounce, pagination loads next page, filters update URL/query params. (3) Performance sanity check — confirm no full-dataset fetch occurs by inspecting network requests. Cover team-members, skills, and tasks list pages.
