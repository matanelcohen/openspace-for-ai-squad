---
id: task-cUIz1Nt4
title: 'Add tests for timeout, JSON error handling, and abort functionality'
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-T4o_NFrB'
created: '2026-04-02T01:29:02.022Z'
updated: '2026-04-02T01:41:56.462Z'
sortIndex: 580
parent: task-T4o_NFrB
dependsOn:
  - task-ip3UVgFm
description: >
  Create apps/web/src/lib/__tests__/api-client.test.ts (or colocate as
  api-client.test.ts). Using vitest (already configured in vitest.config.ts at
  repo root):

  1. Test that fetch is called with an AbortSignal by default (mock fetch,
  inspect the signal option).

  2. Test that a request exceeding timeout throws an appropriate error (use a
  delayed mock).

  3. Test that invalid JSON response body throws ApiError with a clear message.

  4. Test that createCancellableRequest() returns a working signal+abort pair —
  calling abort() should cause the fetch to reject.

  5. Test that caller-provided signals are respected alongside the default
  timeout signal.

  6. Test that the api.get/post/etc helpers pass through the signal option.

  Run with: pnpm vitest run apps/web/src/lib/



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Create apps/web/src/lib/__tests__/api-client.test.ts (or colocate as api-client.test.ts). Using vitest (already configured in vitest.config.ts at repo root):
1. Test that fetch is called with an AbortSignal by default (mock fetch, inspect the signal option).
2. Test that a request exceeding timeout throws an appropriate error (use a delayed mock).
3. Test that invalid JSON response body throws ApiError with a clear message.
4. Test that createCancellableRequest() returns a working signal+abort pair — calling abort() should cause the fetch to reject.
5. Test that caller-provided signals are respected alongside the default timeout signal.
6. Test that the api.get/post/etc helpers pass through the signal option.
Run with: pnpm vitest run apps/web/src/lib/
