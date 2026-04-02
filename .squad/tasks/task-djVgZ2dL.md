---
id: task-djVgZ2dL
title: Test abort and cleanup behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-LevnH79_'
created: '2026-04-02T01:26:15.188Z'
updated: '2026-04-02T01:41:56.560Z'
sortIndex: 573
parent: task-LevnH79_
dependsOn:
  - task-5rQk7Ly4
description: >
  Write tests verifying: (1) apiClient correctly passes AbortSignal to fetch,
  (2) aborted requests throw AbortError and don't trigger state updates, (3)
  rapid navigation cancels previous in-flight requests, (4) no memory leak
  warnings in React strict mode. Cover both unit tests for apiClient and
  integration tests for the hooks.



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Write tests verifying: (1) apiClient correctly passes AbortSignal to fetch, (2) aborted requests throw AbortError and don't trigger state updates, (3) rapid navigation cancels previous in-flight requests, (4) no memory leak warnings in React strict mode. Cover both unit tests for apiClient and integration tests for the hooks.
