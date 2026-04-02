---
id: task-DxdoRIgg
title: Test validation and polling fixes
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-9SacBWxs'
created: '2026-04-02T02:06:15.549Z'
updated: '2026-04-02T02:06:15.555Z'
sortIndex: 605
parent: task-9SacBWxs
dependsOn:
  - task-5DKcG8ol
  - task-fGmyHXqG
---
Write tests covering: (1) Cron form Zod schema unit tests — valid submissions pass, missing required fields fail, overlong strings fail, invalid cron expressions fail, non-existent agent IDs fail. (2) Integration test for the cron page handleSubmit: mock the mutation, submit with invalid data, assert mutation is NOT called and error feedback is shown. (3) Ingestion polling lifecycle test: mount the ingestion-status component, trigger handleIngest, verify only one polling loop is active, unmount the component, and verify all intervals/timeouts are cleaned up (no state updates after unmount). (4) Backend validation tests: POST /api/cron with invalid cron expression returns 400, overlong message returns 400, invalid participant IDs return 400 with details. Use existing test framework (vitest + playwright for e2e if applicable).
