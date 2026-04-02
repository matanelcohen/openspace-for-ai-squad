---
id: task-f8Znyfc9
title: Test pagination and virtualization across all list views
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-PpMs5KiZ'
created: '2026-04-02T02:06:52.910Z'
updated: '2026-04-02T02:06:52.917Z'
sortIndex: 608
parent: task-PpMs5KiZ
dependsOn:
  - task-kQ3GVHuI
---
Write tests covering: (1) API-level tests for each paginated endpoint — verify correct page size, cursor advancement, empty final page, and invalid cursor handling. (2) Integration/component tests for TraceList, MemoryList, and TaskList — verify 'Load More' button appears when more data exists, disappears at end-of-list, and each click appends new items. (3) Verify MemoryList virtualization renders only visible rows in the DOM (check that DOM node count stays bounded). Seed test data with at least 150 items per resource to exercise multi-page flows.
