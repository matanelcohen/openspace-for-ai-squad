---
id: task-zPbxjFXV
title: Test abort and unmount behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-tJllVLTG'
created: '2026-04-02T10:31:21.853Z'
updated: '2026-04-02T10:31:21.859Z'
sortIndex: 27
parent: task-tJllVLTG
dependsOn:
  - task-Vp80pzr-
---
Write tests verifying: (1) passing an AbortSignal to apiClient actually aborts the fetch, (2) components that unmount mid-request do not call setState after unmount (no React warnings), (3) aborting a request does not trigger error handling UI (toasts/alerts). Cover both the apiClient unit level and at least one component integration test (e.g., settings/page.tsx).
