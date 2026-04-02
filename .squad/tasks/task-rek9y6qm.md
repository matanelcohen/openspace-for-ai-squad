---
id: task-rek9y6qm
title: Test pagination across all list pages
status: pending
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-Tf8qZCMT'
created: '2026-04-02T01:26:47.645Z'
updated: '2026-04-02T01:41:56.943Z'
sortIndex: 576
parent: task-Tf8qZCMT
dependsOn:
  - task-cHziworh
  - task-anbu9HKd
description: >
  Write tests verifying pagination works correctly with large datasets:


  1. **Backend integration tests** — test each paginated endpoint (traces,
  tasks, workflows) with: default pagination (limit=50, offset=0), custom page
  sizes, offset beyond total (should return empty data), filtering combined with
  pagination (e.g., filter by status + paginate).

  2. **Frontend component tests** — test TraceList, TaskListView, and workflows
  page render pagination controls, page navigation works (next/prev), page size
  selector changes results count, and total count displays correctly.

  3. **Seed test data** — create helpers to generate 200+ mock traces, tasks,
  and workflows for testing.

  4. **Edge cases** — empty results, single page of results (no next button),
  last page with partial results.


  Use existing test framework (vitest + playwright for e2e if applicable).



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Write tests verifying pagination works correctly with large datasets:

1. **Backend integration tests** — test each paginated endpoint (traces, tasks, workflows) with: default pagination (limit=50, offset=0), custom page sizes, offset beyond total (should return empty data), filtering combined with pagination (e.g., filter by status + paginate).
2. **Frontend component tests** — test TraceList, TaskListView, and workflows page render pagination controls, page navigation works (next/prev), page size selector changes results count, and total count displays correctly.
3. **Seed test data** — create helpers to generate 200+ mock traces, tasks, and workflows for testing.
4. **Edge cases** — empty results, single page of results (no next button), last page with partial results.

Use existing test framework (vitest + playwright for e2e if applicable).
