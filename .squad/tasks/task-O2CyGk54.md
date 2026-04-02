---
id: task-O2CyGk54
title: Test memory leak fix and unsaved-changes guard
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-Znbz0uwv'
created: '2026-04-02T02:20:44.814Z'
updated: '2026-04-02T02:20:44.857Z'
sortIndex: 644
parent: task-Znbz0uwv
dependsOn:
  - task-AbCjDlJQ
  - task-73jtThdt
---
Write tests covering both fixes: (1) For ingestion-status: write a unit test that mounts the component, triggers handleIngest multiple times, and asserts only one interval is active. Write a test that unmounts during polling and asserts clearInterval was called (mock setInterval/clearInterval). Test that the interval clears when ingestion completes. (2) For workflow composer: write a test that modifies a workflow field and asserts isDirty is true. Test that the beforeunload event is prevented when dirty. Test that the confirmation prompt appears when clicking 'Back to workflows' with unsaved changes. Test that saving resets isDirty and allows navigation without prompt.
