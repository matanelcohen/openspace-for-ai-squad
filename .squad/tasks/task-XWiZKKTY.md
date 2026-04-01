---
id: task-XWiZKKTY
title: Test trace pipeline end-to-end
status: pending
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-AhF7rCH-'
created: '2026-04-01T15:13:48.028Z'
updated: '2026-04-01T15:40:17.696Z'
sortIndex: 363
parent: task-AhF7rCH-
dependsOn:
  - task-5K-FQyO5
  - task-WHhQXeJo
description: >
  Verify the entire trace pipeline works correctly with the new enhancements.
  Write comprehensive tests:


  1. **Backend API tests** (`apps/api/src/routes/__tests__/traces.test.ts` or
  similar):
     - Test that tool spans correctly extract `tool.name`, `tool.input`, `tool.output` from attributes JSON
     - Test the new tool analytics endpoint returns correct aggregates (call counts, avg duration, error rates)
     - Test span search endpoint with various filters (by tool name, duration range, status)
     - Test edge cases: spans with missing input/output, very large input/output (>1MB), unicode content, nested JSON objects
     - Test that `inputPreview` and `outputPreview` are correctly truncated

  2. **Tracing package tests** (`packages/tracing/src/__tests__/`):
     - Test `instrumentToolCall()` captures input, output, error, and duration correctly
     - Test that retry count and other new attributes are recorded
     - Test LLM span attributes (stop_reason, temperature, etc.)

  3. **Frontend component tests** (`apps/web/src/components/traces/__tests__/`):
     - Test trace-detail renders tool input/output inline in waterfall
     - Test copy-to-clipboard works for tool I/O
     - Test tool analytics dashboard renders charts with mock data
     - Test error banner displays correctly for failed tool spans
     - Test filter-by-tool-name works in trace list

  4. **Integration test**: Create a mock trace with diverse span types (tool
  success, tool error, LLM call, agent span) and verify the full flow from
  storage → API → UI renders correctly with all new fields visible.


  Key files: Check existing test patterns in `apps/api/src/`,
  `packages/tracing/src/`, `apps/web/src/` and `e2e/` directory. Use vitest
  (configured in `vitest.config.ts`) and playwright (configured in
  `playwright.config.ts`).



  ---

  **[2026-04-01 15:40:17]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Verify the entire trace pipeline works correctly with the new enhancements. Write comprehensive tests:

1. **Backend API tests** (`apps/api/src/routes/__tests__/traces.test.ts` or similar):
   - Test that tool spans correctly extract `tool.name`, `tool.input`, `tool.output` from attributes JSON
   - Test the new tool analytics endpoint returns correct aggregates (call counts, avg duration, error rates)
   - Test span search endpoint with various filters (by tool name, duration range, status)
   - Test edge cases: spans with missing input/output, very large input/output (>1MB), unicode content, nested JSON objects
   - Test that `inputPreview` and `outputPreview` are correctly truncated

2. **Tracing package tests** (`packages/tracing/src/__tests__/`):
   - Test `instrumentToolCall()` captures input, output, error, and duration correctly
   - Test that retry count and other new attributes are recorded
   - Test LLM span attributes (stop_reason, temperature, etc.)

3. **Frontend component tests** (`apps/web/src/components/traces/__tests__/`):
   - Test trace-detail renders tool input/output inline in waterfall
   - Test copy-to-clipboard works for tool I/O
   - Test tool analytics dashboard renders charts with mock data
   - Test error banner displays correctly for failed tool spans
   - Test filter-by-tool-name works in trace list

4. **Integration test**: Create a mock trace with diverse span types (tool success, tool error, LLM call, agent span) and verify the full flow from storage → API → UI renders correctly with all new fields visible.

Key files: Check existing test patterns in `apps/api/src/`, `packages/tracing/src/`, `apps/web/src/` and `e2e/` directory. Use vitest (configured in `vitest.config.ts`) and playwright (configured in `playwright.config.ts`).
